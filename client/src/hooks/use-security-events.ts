/**
 * useSecurityEvents — real-time security event feed via WebSocket.
 *
 * Connects to /api/ws/events (same origin, ws: or wss:) and accumulates
 * incoming classification events in local state.  Reconnects automatically
 * with exponential back-off (1 s → 2 s → 4 s … capped at 30 s) when the
 * connection drops.  Cleans up gracefully on unmount.
 *
 * Each event is flagged `isNew = true` for 2 seconds after arrival so the
 * UI can render a brief highlight; after 2 s the flag is cleared.
 */

import { useState, useEffect, useRef, useCallback } from "react";

export interface SecurityEvent {
  id: string;
  timestamp: string;
  ipAddress: string;
  visitorType: "Human" | "Bot";
  detectionMethod: string;
  country: string;
  isp: string;
  action: "Allowed" | "Blocked";
  /** True for ~2 s after the event arrives; cleared automatically. */
  isNew?: boolean;
}

export interface UseSecurityEventsResult {
  events: SecurityEvent[];
  connected: boolean;
  clear: () => void;
}

const MAX_EVENTS = 100;
const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;
const NEW_EVENT_HIGHLIGHT_MS = 2_000;

export function useSecurityEvents(): UseSecurityEventsResult {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [connected, setConnected] = useState(false);

  // Refs that survive re-renders without triggering them.
  const wsRef = useRef<WebSocket | null>(null);
  const backoffRef = useRef(INITIAL_BACKOFF_MS);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const mountedRef = useRef(true);

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return;
    timerRef.current = setTimeout(() => {
      backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
      connect(); // eslint-disable-line @typescript-eslint/no-use-before-define
    }, backoffRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${window.location.host}/api/ws/events`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      scheduleReconnect();
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return; }
      setConnected(true);
      backoffRef.current = INITIAL_BACKOFF_MS; // reset on success
    };

    ws.onmessage = (evt) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(evt.data as string);
        if (msg.type === "classification" && msg.data) {
          const incoming: SecurityEvent = { ...msg.data, isNew: true };
          setEvents((prev) => [incoming, ...prev].slice(0, MAX_EVENTS));
          // Clear the highlight flag after the animation window.
          setTimeout(() => {
            if (!mountedRef.current) return;
            setEvents((prev) =>
              prev.map((e) => (e.id === incoming.id ? { ...e, isNew: false } : e))
            );
          }, NEW_EVENT_HIGHLIGHT_MS);
        }
      } catch {
        // Ignore malformed frames.
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setConnected(false);
      wsRef.current = null;
      scheduleReconnect();
    };

    ws.onerror = () => {
      ws.close(); // triggers onclose → scheduleReconnect
    };
  }, [scheduleReconnect]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      clearTimeout(timerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const clear = useCallback(() => setEvents([]), []);

  return { events, connected, clear };
}
