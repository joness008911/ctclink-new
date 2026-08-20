import { apiRequest } from "./queryClient";

export interface User {
  id: string;
  username: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<{ user: User; message: string; token?: string }> => {
    const response = await apiRequest("POST", "/api/login", credentials);
    const data = await response.json();
    if (data.token) {
      localStorage.setItem('admin_auth_token', data.token);
    }
    return data;
  },

  logout: async (): Promise<{ message: string }> => {
    try {
      const response = await apiRequest("POST", "/api/logout");
      return await response.json();
    } finally {
      localStorage.removeItem('admin_auth_token');
    }
  },

  getCurrentUser: async (): Promise<User | null> => {
    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('admin_auth_token') : null;
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch("/api/auth/user", { 
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
};
