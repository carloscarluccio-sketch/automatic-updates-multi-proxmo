import api from './api';

export interface LoginCredentials { email: string; password: string; }
export interface User { id: number; username: string; email: string; role: string; company_id: number | null; }
export interface LoginResponse { success: boolean; data: { user: User; accessToken: string; refreshToken: string; }; }

export const authService = {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/auth/login', credentials);
    if (response.data.success) {
      localStorage.setItem('token', response.data.data.accessToken);
      localStorage.setItem('user', JSON.stringify(response.data.data.user));
    }
    return response.data;
  },
  async logout(): Promise<void> {
    try { await api.post('/auth/logout'); } finally { localStorage.clear(); }
  },
  getCurrentUser(): User | null {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },
  isAuthenticated(): boolean { return !!localStorage.getItem('token'); },
};
