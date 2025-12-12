import api from './api';

export interface Template {
  id: number;
  name: string;
  description: string | null;
  vmid: number;
  node_name: string;
  cluster_id: number;
  company_id: number | null;
  os_type: string | null;
  os_version: string | null;
  cpu_cores: number;
  memory_mb: number;
  disk_size_gb: number;
  has_cloud_init: boolean;
  cloud_init_user: string | null;
  is_public: boolean;
  created_by: number;
  created_at: string;
}

class TemplatesService {
  async getAll(): Promise<Template[]> {
    const response = await api.get('/templates');
    return response.data.data;
  }

  async getById(id: number): Promise<Template> {
    const response = await api.get(`/templates/${id}`);
    return response.data.data;
  }

  async create(data: Partial<Template>): Promise<Template> {
    const response = await api.post('/templates', data);
    return response.data.data;
  }

  async update(id: number, data: Partial<Template>): Promise<Template> {
    const response = await api.put(`/templates/${id}`, data);
    return response.data.data;
  }

  async delete(id: number): Promise<void> {
    await api.delete(`/templates/${id}`);
  }

  async cloneFromTemplate(
    templateId: number,
    data: { vm_name: string; target_vmid: number; target_node?: string; company_id?: number }
  ): Promise<any> {
    const response = await api.post(`/templates/${templateId}/clone`, data);
    return response.data.data;
  }
}

export const templatesService = new TemplatesService();
