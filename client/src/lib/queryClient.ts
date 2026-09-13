import { QueryClient, QueryFunction } from "@tanstack/react-query";

export class ApiError extends Error {
  status: number;
  code?: string;
  accountStatus?: string;
  complianceStatus?: string;
  statusReason?: string;
  isHtml: boolean;

  constructor(
    message: string,
    status: number,
    meta?: {
      code?: string;
      accountStatus?: string;
      complianceStatus?: string;
      statusReason?: string;
      isHtml?: boolean;
    }
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = meta?.code;
    this.accountStatus = meta?.accountStatus;
    this.complianceStatus = meta?.complianceStatus;
    this.statusReason = meta?.statusReason;
    this.isHtml = meta?.isHtml || false;
  }
}

export function parseApiError(status: number, rawText: string): { message: string; meta: any } {
  const trimmed = (rawText || "").trim();
  const isHtml = /<[a-z][\s\S]*>/i.test(trimmed) || trimmed.toLowerCase().includes("<!doctype");

  if (isHtml) {
    if (status === 403) {
      return {
        message: "Your account has been suspended. Please contact us if you believe this was done in error.",
        meta: { isHtml: true, code: "ACCOUNT_SUSPENDED", accountStatus: "suspended" }
      };
    }
    if (status === 401) {
      return {
        message: "Your session has expired or you are not authorized. Please log in again.",
        meta: { isHtml: true, code: "UNAUTHORIZED" }
      };
    }
    if (status === 404) {
      return {
        message: "The requested resource could not be found.",
        meta: { isHtml: true, code: "NOT_FOUND" }
      };
    }
    if (status === 429) {
      return {
        message: "Too many requests. Please wait a moment and try again.",
        meta: { isHtml: true, code: "RATE_LIMITED" }
      };
    }
    if (status >= 500) {
      return {
        message: "The server encountered a temporary error. Please try again shortly.",
        meta: { isHtml: true, code: "SERVER_ERROR" }
      };
    }
    return {
      message: "An unexpected error occurred. Please try again.",
      meta: { isHtml: true }
    };
  }

  try {
    const json = JSON.parse(trimmed);
    let msg = json.message || json.error || json.detail || "";

    // Specific account statuses
    if (
      json.code === "ACCOUNT_SUSPENDED" ||
      json.accountStatus === "suspended" ||
      json.complianceStatus === "suspended" ||
      (status === 403 && typeof msg === "string" && msg.toLowerCase().includes("suspend"))
    ) {
      msg = json.statusReason
        ? `Your account has been suspended: ${json.statusReason}. Please contact us if you believe this was done in error.`
        : "Your account has been suspended. Please contact us if you believe this was done in error.";
    } else if (
      json.code === "ACCOUNT_DEACTIVATED" ||
      json.accountStatus === "deactivated" ||
      json.accountStatus === "deleted" ||
      (status === 403 && typeof msg === "string" && msg.toLowerCase().includes("deactivat"))
    ) {
      msg = json.statusReason
        ? `Your account has been deactivated: ${json.statusReason}. Please contact us if you believe this was done in error.`
        : "Your account has been deactivated. Please contact us if you believe this was done in error.";
    } else if (
      json.code === "ACCOUNT_FLAGGED" ||
      json.complianceStatus === "flagged" ||
      json.isFlagged
    ) {
      msg = json.statusReason
        ? `Your account is currently under compliance review (${json.statusReason}). This action is temporarily unavailable.`
        : "Your account is currently under compliance review and this action is temporarily unavailable.";
    } else if (
      json.code === "ACCOUNT_PENDING" ||
      json.complianceStatus === "pending" ||
      json.isPending
    ) {
      msg = json.statusReason
        ? `Your account is pending verification and review (${json.statusReason}). This action is unavailable until your account is cleared.`
        : "Your account is pending verification and review. This action is unavailable until your account is cleared.";
    }

    if (!msg) {
      if (status === 403) {
        msg = "Your account has been suspended. Please contact us if you believe this was done in error.";
      } else if (status === 401) {
        msg = "Invalid credentials or your session has expired. Please sign in again.";
      } else if (status >= 500) {
        msg = "Server error. Please try again later.";
      } else {
        msg = "Request could not be completed. Please try again.";
      }
    }

    return {
      message: msg,
      meta: {
        code: json.code,
        accountStatus: json.accountStatus,
        complianceStatus: json.complianceStatus,
        statusReason: json.statusReason,
        isHtml: false
      }
    };
  } catch {
    // Non-JSON string
    let msg = trimmed;
    if (!msg || msg === "Forbidden" || msg.toLowerCase().includes("forbidden")) {
      if (status === 403) {
        msg = "Your account has been suspended. Please contact us if you believe this was done in error.";
      } else if (status === 401) {
        msg = "Invalid credentials or session expired. Please log in.";
      } else {
        msg = `Request failed (${status}). Please try again.`;
      }
    }
    return {
      message: msg,
      meta: { isHtml: false }
    };
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const rawText = (await res.text()) || res.statusText;
    const { message, meta } = parseApiError(res.status, rawText);
    throw new ApiError(message, res.status, meta);
  }
}

function getAuthHeaders(url?: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const clientToken = typeof localStorage !== 'undefined' ? localStorage.getItem('client_auth_token') : null;
  const adminToken = typeof localStorage !== 'undefined' ? localStorage.getItem('admin_auth_token') : null;

  if (url && (url.startsWith('/api/user') || url.includes('/user/'))) {
    if (clientToken) headers['Authorization'] = `Bearer ${clientToken}`;
  } else if (url && (url.startsWith('/api/auth') || url.startsWith('/api/interface') || url.startsWith('/api/api-keys') || url.startsWith('/api/whitelist') || url.startsWith('/api/blacklist') || url.startsWith('/api/rules') || url.startsWith('/api/stats') || url.startsWith('/api/classifications') || url.startsWith('/api/audit-logs') || url.startsWith('/api/settings'))) {
    if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
  } else {
    // If not matched, send available token
    if (clientToken) headers['X-Client-Token'] = clientToken;
    if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
  }
  return headers;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const authHeaders = getAuthHeaders(url);
  const res = await fetch(url, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...authHeaders,
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;
    const authHeaders = getAuthHeaders(url);
    const res = await fetch(url, {
      headers: authHeaders,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && (res.status === 401 || res.status === 403)) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
