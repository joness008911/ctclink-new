import { apiRequest } from "./queryClient";

export interface ClientUser {
  id: string;
  username: string;
  fullName?: string | null;
  email: string | null;
  status: string;
  subscriptionStatus?: string;
  trialEndsAt?: string | Date | null;
  trialDaysRemaining?: number | null;
  createdAt: Date;
  apiKey?: {
    name: string;
    status: string;
    expirationPeriod: string;
    callLimit: number;
  } | null;
}

export interface UserLoginCredentials {
  username: string; // Accepts username or email
  password: string;
}

export interface UserRegisterPayload {
  fullName?: string;
  username?: string;
  email: string;
  password: string;
  newsletter?: boolean;
  tosAccepted: boolean;
}

export interface GoogleAuthPayload {
  email: string;
  name?: string;
  googleId: string;
  idToken?: string;
}

export interface VerifyApiKeyPayload {
  apiKey: string;
}

export const userAuthApi = {
  register: async (payload: UserRegisterPayload): Promise<any> => {
    const response = await apiRequest("POST", "/api/user/register", payload);
    const data = await response.json();
    if (data.token) {
      localStorage.setItem('client_auth_token', data.token);
    }
    return data;
  },

  googleAuth: async (payload: GoogleAuthPayload): Promise<any> => {
    const response = await apiRequest("POST", "/api/user/google-auth", payload);
    const data = await response.json();
    if (data.token) {
      localStorage.setItem('client_auth_token', data.token);
    }
    return data;
  },

  login: async (credentials: UserLoginCredentials): Promise<any> => {
    const response = await apiRequest("POST", "/api/user/login", credentials);
    const data = await response.json();
    if (data.token) {
      localStorage.setItem('client_auth_token', data.token);
    }
    return data;
  },

  verifyApiKey: async (payload: VerifyApiKeyPayload): Promise<any> => {
    const response = await apiRequest("POST", "/api/user/verify-api-key", payload);
    const data = await response.json();
    if (data.token) {
      localStorage.setItem('client_auth_token', data.token);
    }
    return data;
  },

  logout: async (): Promise<{ message: string }> => {
    try {
      const response = await apiRequest("POST", "/api/user/logout");
      return await response.json();
    } finally {
      localStorage.removeItem('client_auth_token');
    }
  },

  getCurrentUser: async (): Promise<ClientUser | null> => {
    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('client_auth_token') : null;
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch("/api/user/me", { 
        headers,
        credentials: "include" 
      });
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        return null;
      }
      if (!res.ok) {
        throw new Error(`${res.status}: ${res.statusText}`);
      }
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  acceptTos: async (): Promise<any> => {
    const response = await apiRequest("POST", "/api/user/accept-tos");
    const data = await response.json();
    if (data.token) {
      localStorage.setItem('client_auth_token', data.token);
    }
    return data;
  },
};
