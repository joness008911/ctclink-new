import { apiRequest } from "./queryClient";

export interface ClientUser {
  id: string;
  username: string;
  fullName?: string | null;
  email: string | null;
  emailVerified?: boolean;
  emailVerifiedAt?: string | Date | null;
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

export interface ForgotPasswordPayload {
  email: string;
}

export interface VerifyResetCodePayload {
  email: string;
  code: string;
}

export interface ResetPasswordPayload {
  email: string;
  code?: string;
  token?: string;
  newPassword: string;
}

export interface VerifyEmailPayload {
  email?: string;
  code?: string;
  token?: string;
}

export interface ResendVerificationPayload {
  email: string;
}

export const userAuthApi = {
  forgotPassword: async (payload: ForgotPasswordPayload): Promise<{ success: boolean; message: string; devCode?: string; email?: string }> => {
    const response = await apiRequest("POST", "/api/user/forgot-password", payload);
    return await response.json();
  },

  verifyResetCode: async (payload: VerifyResetCodePayload): Promise<{ valid: boolean; token?: string; message?: string }> => {
    const response = await apiRequest("POST", "/api/user/verify-reset-code", payload);
    return await response.json();
  },

  resetPassword: async (payload: ResetPasswordPayload): Promise<{ success: boolean; message: string }> => {
    const response = await apiRequest("POST", "/api/user/reset-password", payload);
    return await response.json();
  },

  verifyEmail: async (payload: VerifyEmailPayload): Promise<{ success: boolean; message: string; token?: string; user?: any; alreadyVerified?: boolean }> => {
    const response = await apiRequest("POST", "/api/user/verify-email", payload);
    const data = await response.json();
    if (data.token) {
      localStorage.setItem('client_auth_token', data.token);
    }
    return data;
  },

  resendVerification: async (payload: ResendVerificationPayload): Promise<{ success: boolean; message: string; devCode?: string; devLink?: string; expiresAt?: number; alreadyVerified?: boolean; retryAfter?: number }> => {
    const response = await apiRequest("POST", "/api/user/resend-verification", payload);
    return await response.json();
  },

  getVerificationStatus: async (email?: string): Promise<{ email: string; emailVerified: boolean; emailVerifiedAt?: string | null; subscriptionStatus?: string }> => {
    const url = email ? `/api/user/verification-status?email=${encodeURIComponent(email)}` : "/api/user/verification-status";
    const response = await fetch(url, { credentials: "include" });
    return await response.json();
  },

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
