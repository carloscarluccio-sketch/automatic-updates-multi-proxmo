import api from './api';

export interface IPRange {
  id: number;
  company_id: number | null;
  cluster_id: number;
  subnet: string;
  gateway: string | null;
  netmask: string | null;
  vlan_id: number | null;
  sdn_zone: string | null;
  sdn_vnet: string | null;
  description: string | null;
  ip_type: 'internal' | 'external';
  is_shared: boolean | null;
  created_at: string;
  updated_at: string;
  companies?: {
    id: number;
    name: string;
  } | null;
  proxmox_clusters?: {
    id: number;
    name: string;
    location: string | null;
  };
  _count?: {
    vm_ip_assignments: number;
  };
}

export interface IPRangeFormData {
  subnet: string;
  description?: string;
  gateway?: string;
  netmask?: string;
  vlan_id?: number;
  sdn_zone?: string;
  sdn_vnet?: string;
  ip_type?: 'internal' | 'external';
  is_shared?: boolean;
  company_id?: number;
  cluster_id: number;
}

export interface AvailableIPsData {
  subnet: string;
  gateway: string | null;
  assigned_count: number;
  assigned_ips: string[];
}

class IPRangesService {
  async getAll(params?: { company_id?: number; cluster_id?: number; ip_type?: string }) {
    const queryParams = new URLSearchParams();
    if (params?.company_id) queryParams.append('company_id', params.company_id.toString());
    if (params?.cluster_id) queryParams.append('cluster_id', params.cluster_id.toString());
    if (params?.ip_type) queryParams.append('ip_type', params.ip_type);

    const url = `/ip-ranges${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return api.get<{ success: boolean; data: IPRange[] }>(url);
  }

  async getById(id: number) {
    return api.get<{ success: boolean; data: IPRange }>(`/ip-ranges/${id}`);
  }

  async create(data: IPRangeFormData) {
    return api.post<{ success: boolean; data: IPRange }>('/ip-ranges', data);
  }

  async update(id: number, data: Partial<IPRangeFormData>) {
    return api.put<{ success: boolean; data: IPRange }>(`/ip-ranges/${id}`, data);
  }

  async delete(id: number) {
    return api.delete<{ success: boolean; message: string }>(`/ip-ranges/${id}`);
  }

  async getAvailableIPs(id: number) {
    return api.get<{ success: boolean; data: AvailableIPsData }>(`/ip-ranges/${id}/available`);
  }
}

export default new IPRangesService();
