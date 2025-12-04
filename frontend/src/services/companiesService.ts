import api from './api';

export interface Company {
  id: number;
  name: string;
  owner_name: string;
  primary_email: string;
  contact_email?: string;
}

export const companiesService = {
  async getAll(): Promise<Company[]> {
    const response = await api.get('/companies');
    return response.data.data || [];
  },
  async create(data: Partial<Company>): Promise<Company> {
    const response = await api.post('/companies', data);
    return response.data.data;
  },
  async update(id: number, data: Partial<Company>): Promise<Company> {
    const response = await api.put(`/companies/${id}`, data);
    return response.data.data;
  },
  async delete(id: number): Promise<void> {
    await api.delete(`/companies/${id}`);
  },
};
