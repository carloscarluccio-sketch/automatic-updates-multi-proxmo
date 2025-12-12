import api from './api';

export interface VM {
  id: number;
  name: string;
  vmid: number;
  node: string;
  status: string | null;
  cpu_cores: number | null;
  memory_mb: number | null;
  storage_gb: number | null;
  os_type?: string | null;
  cluster_id: number;
  company_id: number;
  project_id?: number | null;  // ADDED: project assignment
  created_at: string | null;
}

export interface VMStatus {
  status: string;
  cpu: number;
  mem: number;
  maxmem: number;
  disk: number;
  maxdisk: number;
  uptime: number;
}

export const vmsService = {
  async getAll(): Promise<VM[]> {
    const response = await api.get('/vms');
    return response.data.data || [];
  },

  async getStatus(id: number): Promise<VMStatus> {
    const response = await api.get(`/vms/${id}/status`);
    return response.data.data;
  },

  async create(data: any): Promise<VM> {
    const response = await api.post('/vms', data);
    return response.data.data;
  },

  async update(id: number, data: any): Promise<VM> {
    const response = await api.put(`/vms/${id}`, data);
    return response.data.data;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/vms/${id}`);
  },

  async start(id: number): Promise<void> {
    await api.post(`/vms/${id}/control`, { action: 'start' });
  },

  async stop(id: number): Promise<void> {
    await api.post(`/vms/${id}/control`, { action: 'stop' });
  },

  async control(id: number, action: 'start' | 'stop' | 'restart'): Promise<void> {
    await api.post(`/vms/${id}/control`, { action });
  },

  // NEW: Assign VM to project (or unassign if project_id is null)
  async assignToProject(id: number, project_id: number | null): Promise<void> {
    await api.post(`/vms/${id}/assign-project`, { project_id });
  },
};
