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
  login: async (credentials: LoginCredentials): Promise<{ user: User; message: string }> => {
    const response = await apiRequest("POST", "/api/login", credentials);
    return response.json();
  },

  logout: async (): Promise<{ message: string }> => {
    const response = await apiRequest("POST", "/api/logout");
    return response.json();
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await apiRequest("GET", "/api/auth/user");
    return response.json();
  },
};
