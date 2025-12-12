import api from './api';

export interface Cluster {
  id: number;
  name: string;
  location: string | null;
  host: string;
  port: number | null;
  username: string;
  realm: string | null;
  ssl_verify: boolean | null;
  status: string | null;
  company_id: number | null;
  cluster_type: string | null;
  proxmox_version: string | null;
  proxmox_release: string | null;
  version_last_checked: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClusterFormData {
  name: string;
  location?: string;
  host: string;
  port?: number;
  username: string;
  password: string;
  realm?: string;
  ssl_verify?: boolean;
  status?: string;
  cluster_type?: string;
  company_id?: number | null;
}

export const clustersService = {
  async getAll(includeVersion?: boolean, clusterId?: number): Promise<Cluster[]> {
    let url = '/clusters';
    const params = new URLSearchParams();
    if (includeVersion) params.append('include_version', 'true');
    if (clusterId) params.append('cluster_id', clusterId.toString());
    if (params.toString()) url += '?' + params.toString();
    
    const response = await api.get(url);
    return response.data.data || [];
  },

  async getById(id: number): Promise<Cluster> {
    const response = await api.get(`/clusters/${id}`);
    return response.data.data;
  },

  async create(data: ClusterFormData): Promise<Cluster> {
    const response = await api.post('/clusters', data);
    return response.data.data;
  },

  async update(id: number, data: Partial<ClusterFormData>): Promise<Cluster> {
    const response = await api.put(`/clusters/${id}`, data);
    return response.data.data;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/clusters/${id}`);
  },

  async fetchVersion(id: number): Promise<Cluster> {
    const clusters = await this.getAll(true, id);
    return clusters[0];
  },
};
