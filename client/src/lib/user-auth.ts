import { apiRequest } from "./queryClient";

export interface ClientUser {
  id: string;
  username: string;
  email: string | null;
  status: string;
  createdAt: Date;
  apiKey?: {
    name: string;
    status: string;
    expirationPeriod: string;
    callLimit: number;
  } | null;
}

export interface UserLoginCredentials {
  username: string;
  password: string;
}

export interface VerifyApiKeyPayload {
  apiKey: string;
}

export const userAuthApi = {
  login: async (credentials: UserLoginCredentials): Promise<any> => {
    const response = await apiRequest("POST", "/api/user/login", credentials);
    return response.json();
  },

  verifyApiKey: async (payload: VerifyApiKeyPayload): Promise<any> => {
    const response = await apiRequest("POST", "/api/user/verify-api-key", payload);
    return response.json();
  },

  logout: async (): Promise<{ message: string }> => {
    const response = await apiRequest("POST", "/api/user/logout");
    return response.json();
  },

  getCurrentUser: async (): Promise<ClientUser> => {
    const response = await apiRequest("GET", "/api/user/me");
    return response.json();
  },

  acceptTos: async (): Promise<{ message: string }> => {
    const response = await apiRequest("POST", "/api/user/accept-tos");
    return response.json();
  },
};
