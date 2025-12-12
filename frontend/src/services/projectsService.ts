import api from './api';

export interface Project {
  id: number;
  company_id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  opnsense_id: number | null;
  companies?: {
    id: number;
    name: string;
  };
  _count?: {
    virtual_machines: number;
  };
  virtual_machines?: Array<{
    id: number;
    name: string;
    vmid: number;
    node: string;
    status: string | null;
    cores: number | null;
    memory: number | null;
  }>;
}

export interface ProjectFormData {
  name: string;
  description?: string;
  company_id?: number;
}

export const projectsService = {
  async getAll(companyId?: number): Promise<Project[]> {
    let url = '/projects';
    if (companyId) {
      url += `?company_id=${companyId}`;
    }
    const response = await api.get(url);
    return response.data.data || [];
  },

  async getById(id: number): Promise<Project> {
    const response = await api.get(`/projects/${id}`);
    return response.data.data;
  },

  async create(data: ProjectFormData): Promise<Project> {
    const response = await api.post('/projects', data);
    return response.data.data;
  },

  async update(id: number, data: Partial<ProjectFormData>): Promise<Project> {
    const response = await api.put(`/projects/${id}`, data);
    return response.data.data;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/projects/${id}`);
  },
};
