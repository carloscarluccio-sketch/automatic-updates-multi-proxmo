import axios, { AxiosInstance } from 'axios';
import https from 'https';
import logger from './logger';

interface ProxmoxCluster {
  host: string;
  port: number;
  username: string;
}

export class ProxmoxAPI {
  private client: AxiosInstance;

  constructor(cluster: ProxmoxCluster, password: string) {
    this.client = axios.create({
      baseURL: `https://${cluster.host}:${cluster.port}/api2/json`,
      headers: { 'Content-Type': 'application/json' },
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      timeout: 30000,
    });
    this.authenticate(cluster.username, password);
  }

  private async authenticate(username: string, password: string): Promise<void> {
    try {
      const response = await this.client.post('/access/ticket', { username, password });
      if (response.data?.data?.ticket) {
        this.client.defaults.headers.common['CSRFPreventionToken'] = response.data.data.CSRFPreventionToken;
        this.client.defaults.headers.common['Cookie'] = `PVEAuthCookie=${response.data.data.ticket}`;
      }
    } catch (error) {
      logger.error('Proxmox authentication failed:', error);
      throw new Error('Failed to authenticate with Proxmox');
    }
  }

  async getNodes(): Promise<any[]> {
    const response = await this.client.get('/nodes');
    return response.data?.data || [];
  }

  async getVMs(node: string): Promise<any[]> {
    const response = await this.client.get(`/nodes/${node}/qemu`);
    return response.data?.data || [];
  }

  async getVMStatus(node: string, vmid: number): Promise<any> {
    const response = await this.client.get(`/nodes/${node}/qemu/${vmid}/status/current`);
    return response.data?.data || {};
  }

  async startVM(node: string, vmid: number): Promise<void> {
    await this.client.post(`/nodes/${node}/qemu/${vmid}/status/start`);
  }

  async stopVM(node: string, vmid: number): Promise<void> {
    await this.client.post(`/nodes/${node}/qemu/${vmid}/status/stop`);
  }

  async getVersion(): Promise<string> {
    const response = await this.client.get('/version');
    return response.data?.data?.version || 'Unknown';
  }
}

export default ProxmoxAPI;
