import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
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
