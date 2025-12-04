import api from './api';
import { User } from './authService';

export interface CreateUserDto {
  username: string;
  email: string;
  password: string;
  role: string;
  company_id?: number | null;
}

export const usersService = {
  async getAll(): Promise<User[]> {
    const response = await api.get('/users');
    return response.data.data || [];
  },
  async create(data: CreateUserDto): Promise<User> {
    const response = await api.post('/users', data);
    return response.data.data;
  },
  async update(id: number, data: Partial<CreateUserDto>): Promise<User> {
    const response = await api.put(`/users/${id}`, data);
    return response.data.data;
  },
  async delete(id: number): Promise<void> {
    await api.delete(`/users/${id}`);
  },
};
