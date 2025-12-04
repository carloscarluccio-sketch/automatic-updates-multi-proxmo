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
  cluster_id: number;
  company_id: number;
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

  async start(id: number): Promise<void> {
    await api.post(`/vms/${id}/control`, { action: 'start' });
  },

  async stop(id: number): Promise<void> {
    await api.post(`/vms/${id}/control`, { action: 'stop' });
  },
};
