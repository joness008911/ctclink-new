/**
 * WebSocket server for real-time security event streaming.
 *
 * Architecture:
 *   - One `WebSocketServer` in `noServer` mode; the HTTP server's `upgrade`
 *     event handles routing and all auth before handing off to the ws library.
 *   - Each authenticated client user is subscribed under their `apiKeyId`.
 *     `broadcastClassification` pushes events to every open connection for
 *     that API key.
 *
 * Security (mirrors the REST classification endpoints):
 *   1. requireClientAuth — session must have clientUserId AND
 *      clientUserAuthenticated (API-key verified, two-step login complete).
 *   2. Admin namespace exclusion — session must NOT carry userId.
 *   3. IP whitelist — same check applied to /api/user HTTP routes; passed in
 *      as a callback to avoid a circular import with routes.ts.
 *   4. Active subscription — same predicate as requireActiveSubscription;
 *      expired/cancelled accounts cannot receive live classification data.
 *
 *   Each connection is scoped to its own apiKeyId so one customer never
 *   receives another's events.
 */

import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { RequestHandler } from "express";
import { storage } from "./storage";

export interface SecurityEventPayload {
  id: string;
  timestamp: string;
  ipAddress: string;
  visitorType: "Human" | "Bot";
  detectionMethod: string;
  country: string;
  isp: string;
  action: "Allowed" | "Blocked";
}

// Map: apiKeyId → set of open WebSocket connections for that key's owner(s)
const connections = new Map<string, Set<WebSocket>>();

/**
 * Push a classification event to every open connection subscribed to `apiKeyId`.
 * No-ops silently when there are no connected clients for that key.
 */
export function broadcastClassification(
  apiKeyId: string,
  event: SecurityEventPayload
): void {
  const sockets = connections.get(apiKeyId);
  if (!sockets || sockets.size === 0) return;
  const payload = JSON.stringify({ type: "classification", data: event });
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(payload);
      } catch {
        // The close handler cleans up the dead socket; nothing to do here.
      }
    }
  }
}

/**
 * Attach the WebSocket server to the existing HTTP server.
 *
 * @param httpServer    The Node http.Server created from the Express app.
 * @param sessionMiddleware  The same express-session instance registered on `app`.
 * @param isIpAllowed   Async predicate that mirrors the /api/user IP whitelist
 *                      logic; pass from routes.ts to avoid a circular import.
 *                      Fail-open (return true) on transient errors.
 */
export function setupWebSocketServer(
  httpServer: Server,
  sessionMiddleware: RequestHandler,
  isIpAllowed: (ip: string) => Promise<boolean>
): void {
  const wss = new WebSocketServer({ noServer: true });

  // Intercept HTTP Upgrade requests before the ws library sees them so we
  // can authenticate and authorise inline — before any handshake data flows.
  httpServer.on("upgrade", async (req: any, socket, head) => {
    // Route guard — only our events endpoint is handled here.
    const pathname = req.url?.split("?")[0];
    if (pathname !== "/api/ws/events") {
      socket.destroy();
      return;
    }

    // ── IP whitelist (mirrors the /api/user route-level middleware) ──────────
    const clientIp = (
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket?.remoteAddress ||
      ""
    ).replace("::ffff:", "").trim();

    let ipOk = true;
    try {
      ipOk = await isIpAllowed(clientIp);
    } catch {
      ipOk = true; // fail-open matches the HTTP middleware behaviour
    }
    if (!ipOk) {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }

    // ── Session authentication ───────────────────────────────────────────────
    // Run express-session so req.session is populated from the Cookie header.
    // We pass a no-op response object; session needs to read only, not write.
    sessionMiddleware(req, {} as any, () => {
      // Mirror requireClientAuth:
      //  • clientUserId + clientUserAuthenticated → two-step login complete
      //  • userId absent → admin namespace exclusion
      const clientUserId: string | undefined = req.session?.clientUserId;
      const clientUserAuthenticated: boolean | undefined =
        req.session?.clientUserAuthenticated;
      const adminUserId: string | undefined = req.session?.userId;

      if (!clientUserId || !clientUserAuthenticated || adminUserId) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      // Hand off to the ws library for the actual WS handshake.
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    });
  });

  // ── Post-handshake: subscription check & channel registration ────────────
  wss.on("connection", async (ws: WebSocket, req: any) => {
    const clientUserId: string | undefined = req.session?.clientUserId;
    if (!clientUserId) {
      ws.close(1008, "Unauthorized");
      return;
    }

    // Resolve user — needed for both subscription check and apiKeyId.
    let user: Awaited<ReturnType<typeof storage.getClientUser>>;
    try {
      user = await storage.getClientUser(clientUserId);
    } catch (err) {
      console.error("WS: failed to load user", clientUserId, err);
      ws.close(1011, "Server error");
      return;
    }

    if (!user) {
      ws.close(1008, "User not found");
      return;
    }

    // ── Active subscription check (mirrors requireActiveSubscription) ───────
    const now = new Date();
    const isSubscriptionOk =
      user.subscriptionStatus === "active" ||
      (user.subscriptionStatus === "trialing" &&
        (!user.trialEndsAt || user.trialEndsAt > now));

    if (!isSubscriptionOk) {
      // Close with a normal closure (1000) so the client knows not to retry
      // indefinitely with back-off — it needs to upgrade the subscription first.
      ws.close(1000, "Subscription inactive or expired");
      return;
    }

    // ── Channel registration ────────────────────────────────────────────────
    const apiKeyId = user.apiKeyId;
    if (!apiKeyId) {
      ws.close(1008, "No API key associated with account");
      return;
    }

    if (!connections.has(apiKeyId)) {
      connections.set(apiKeyId, new Set());
    }
    connections.get(apiKeyId)!.add(ws);

    // Confirm subscription to the client so the UI can flip to "Live".
    try {
      ws.send(JSON.stringify({ type: "connected" }));
    } catch { /* ignore */ }

    // Clean up on disconnect.
    const onClose = () => {
      const sockets = connections.get(apiKeyId);
      if (sockets) {
        sockets.delete(ws);
        if (sockets.size === 0) connections.delete(apiKeyId);
      }
    };

    ws.on("close", onClose);
    ws.on("error", (err) => {
      console.error("WS error for user", clientUserId, err.message);
      ws.close();
    });
  });
}
