import axios, { AxiosInstance } from 'axios';
import https from 'https';
import logger from './logger';

interface ProxmoxCluster {
  host: string;
  port: number;
  username: string;
}

interface VMConfig {
  vmid: number;
  name: string;
  cores?: number;
  memory?: number;
  sockets?: number;
  storage?: string;
  disk_size?: string;
  ostype?: string;
  iso?: string;
  net0?: string;
  ide2?: string;
  scsi0?: string;
  ipconfig0?: string;
  boot?: string;
  agent?: string | number;
  scsihw?: string;
  cpu?: string;
  [key: string]: any;
}

export class ProxmoxAPI {
  private client: AxiosInstance;
  private ticket: string | null = null;
  private csrfToken: string | null = null;
  private authPromise: Promise<void>;

  constructor(cluster: ProxmoxCluster, password: string) {
    this.client = axios.create({
      baseURL: `https://${cluster.host}:${cluster.port}/api2/json`,
      headers: { 'Content-Type': 'application/json' },
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      timeout: 30000,
    });
    // Store authentication promise to ensure it completes before any API calls
    this.authPromise = this.authenticate(cluster.username, password);
  }

  private async authenticate(username: string, password: string): Promise<void> {
    try {
      const response = await this.client.post('/access/ticket', { username, password });
      if (response.data?.data?.ticket) {
        this.ticket = response.data.data.ticket;
        this.csrfToken = response.data.data.CSRFPreventionToken;
        this.client.defaults.headers.common['CSRFPreventionToken'] = this.csrfToken;
        this.client.defaults.headers.common['Cookie'] = `PVEAuthCookie=${this.ticket}`;
      }
    } catch (error) {
      logger.error('Proxmox authentication failed:', error);
      throw new Error('Failed to authenticate with Proxmox');
    }
  }

  // Ensure authentication completes before making API calls
  public async ensureAuthenticated(): Promise<void> {
    await this.authPromise;
  }

  async getNodes(): Promise<any[]> {
    await this.ensureAuthenticated();
    const response = await this.client.get('/nodes');
    return response.data?.data || [];
  }

  async getVMs(node: string): Promise<any[]> {
    await this.ensureAuthenticated();
    const response = await this.client.get(`/nodes/${node}/qemu`);
    return response.data?.data || [];
  }

  async getVMStatus(node: string, vmid: number): Promise<any> {
    await this.ensureAuthenticated();
    const response = await this.client.get(`/nodes/${node}/qemu/${vmid}/status/current`);
    return response.data?.data || {};
  }

  async getVMConfig(node: string, vmid: number): Promise<any> {
    await this.ensureAuthenticated();
    const response = await this.client.get(`/nodes/${node}/qemu/${vmid}/config`);
    return response.data?.data || {};
  }

  async startVM(node: string, vmid: number): Promise<void> {
    await this.ensureAuthenticated();

    // Check current status first
    try {
      console.log(`[PROXMOX] Checking status before starting VM ${vmid} on node ${node}`);
      const status = await this.getVMStatus(node, vmid);
      console.log(`[PROXMOX] Current VM status:`, status);

      if (status.status === 'running') {
        console.log(`[PROXMOX] VM ${vmid} is already running`);
        throw new Error('VM_ALREADY_RUNNING');
      }
    } catch (error: any) {
      if (error.message === 'VM_ALREADY_RUNNING') {
        throw error;
      }
      // If status check fails, continue anyway
      console.log(`[PROXMOX] Failed to check VM status, continuing:`, error.message);
    }

    try {
      console.log(`[PROXMOX] Sending start command to VM ${vmid}`);
      const response = await this.client.post(`/nodes/${node}/qemu/${vmid}/status/start`, {});
      console.log(`[PROXMOX] Start command response:`, response.data);
    } catch (error: any) {
      console.error(`[PROXMOX] Start VM error:`, error.message);
      console.error(`[PROXMOX] Error response:`, error.response?.data);
      console.error(`[PROXMOX] Error status:`, error.response?.status);

      // Extract Proxmox error details
      const proxmoxError = error.response?.data?.errors || error.response?.data;
      console.error(`[PROXMOX] Proxmox error details:`, proxmoxError);

      throw error;
    }
  }

  async stopVM(node: string, vmid: number): Promise<void> {
    await this.ensureAuthenticated();

    // Check current status first
    try {
      console.log(`[PROXMOX] Checking status before stopping VM ${vmid} on node ${node}`);
      const status = await this.getVMStatus(node, vmid);
      console.log(`[PROXMOX] Current VM status:`, status);

      if (status.status === 'stopped') {
        console.log(`[PROXMOX] VM ${vmid} is already stopped`);
        throw new Error('VM_ALREADY_STOPPED');
      }
    } catch (error: any) {
      if (error.message === 'VM_ALREADY_STOPPED') {
        throw error;
      }
      // If status check fails, continue anyway
      console.log(`[PROXMOX] Failed to check VM status, continuing:`, error.message);
    }

    try {
      console.log(`[PROXMOX] Sending stop command to VM ${vmid}`);
      const response = await this.client.post(`/nodes/${node}/qemu/${vmid}/status/stop`, {});
      console.log(`[PROXMOX] Stop command response:`, response.data);
    } catch (error: any) {
      console.error(`[PROXMOX] Stop VM error:`, error.message);
      console.error(`[PROXMOX] Error response:`, error.response?.data);
      console.error(`[PROXMOX] Error status:`, error.response?.status);

      // Extract Proxmox error details
      const proxmoxError = error.response?.data?.errors || error.response?.data;
      console.error(`[PROXMOX] Proxmox error details:`, proxmoxError);

      throw error;
    }
  }

  async shutdownVM(node: string, vmid: number, timeout: number = 60): Promise<void> {
    await this.ensureAuthenticated();
    await this.client.post(`/nodes/${node}/qemu/${vmid}/status/shutdown`, { timeout });
  }

  async rebootVM(node: string, vmid: number, timeout: number = 60): Promise<void> {
    await this.ensureAuthenticated();
    await this.client.post(`/nodes/${node}/qemu/${vmid}/status/reboot`, { timeout });
  }

  async resetVM(node: string, vmid: number): Promise<void> {
    await this.ensureAuthenticated();
    await this.client.post(`/nodes/${node}/qemu/${vmid}/status/reset`, {});
  }

  async suspendVM(node: string, vmid: number): Promise<void> {
    await this.ensureAuthenticated();
    await this.client.post(`/nodes/${node}/qemu/${vmid}/status/suspend`, {});
  }

  async resumeVM(node: string, vmid: number): Promise<void> {
    await this.ensureAuthenticated();
    await this.client.post(`/nodes/${node}/qemu/${vmid}/status/resume`, {});
  }

  async createVM(node: string, config: VMConfig): Promise<string> {
    await this.ensureAuthenticated();
    const response = await this.client.post(`/nodes/${node}/qemu`, config);
    return response.data?.data || '';
  }

  async cloneVM(node: string, vmid: number, newid: number, name?: string, full?: boolean): Promise<string> {
    await this.ensureAuthenticated();
    const config: any = { newid, full: full ? 1 : 0 };
    if (name) config.name = name;
    const response = await this.client.post(`/nodes/${node}/qemu/${vmid}/clone`, config);
    return response.data?.data || '';
  }

  async deleteVM(node: string, vmid: number, purge: boolean = true): Promise<string> {
    await this.ensureAuthenticated();
    const response = await this.client.delete(`/nodes/${node}/qemu/${vmid}`, {
      params: { purge: purge ? 1 : 0 },
    });
    return response.data?.data || '';
  }

  async updateVMConfig(node: string, vmid: number, config: Partial<VMConfig>): Promise<void> {
    await this.ensureAuthenticated();
    await this.client.put(`/nodes/${node}/qemu/${vmid}/config`, config);
  }

  async getTaskStatus(node: string, upid: string): Promise<any> {
    await this.ensureAuthenticated();
    const response = await this.client.get(`/nodes/${node}/tasks/${upid}/status`);
    return response.data?.data || {};
  }

  async waitForTask(node: string, upid: string, timeout: number = 300000): Promise<any> {
    await this.ensureAuthenticated();
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const status = await this.getTaskStatus(node, upid);
      if (status.status === 'stopped') {
        if (status.exitstatus === 'OK') {
          return status;
        } else {
          throw new Error(`Task failed: ${status.exitstatus}`);
        }
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    throw new Error('Task timeout');
  }

  async getVersion(): Promise<string> {
    await this.ensureAuthenticated();
    const response = await this.client.get('/version');
    return response.data?.data?.version || 'Unknown';
  }

  // NEW: Get next available VMID
  async getNextVMID(): Promise<number> {
    await this.ensureAuthenticated();
    const response = await this.client.get('/cluster/nextid');
    return parseInt(response.data?.data || '100', 10);
  }

  // NEW: Get storage list for a node
  async getStorages(node: string): Promise<any[]> {
    await this.ensureAuthenticated();
    const response = await this.client.get(`/nodes/${node}/storage`);
    return (response.data?.data || []).filter((storage: any) =>
      storage.type === 'dir' || storage.type === 'lvm' || storage.type === 'lvmthin' ||
      storage.type === 'zfspool' || storage.type === 'nfs' || storage.type === 'cifs'
    );
  }

  // NEW: Get ISO files from a storage
  async getISOs(node: string, storage: string): Promise<any[]> {
    await this.ensureAuthenticated();
    try {
      const response = await this.client.get(`/nodes/${node}/storage/${storage}/content`, {
        params: { content: 'iso' }
      });
      return response.data?.data || [];
    } catch (error) {
      logger.warn(`Failed to get ISOs from storage ${storage}:`, error);
      return [];
    }
  }

  // NEW: Get all ISOs from all storages on a node
  async getAllISOs(node: string): Promise<any[]> {
    await this.ensureAuthenticated();
    const storages = await this.getStorages(node);
    const isos: any[] = [];

    for (const storage of storages) {
      try {
        const storageISOs = await this.getISOs(node, storage.storage);
        isos.push(...storageISOs.map((iso: any) => ({
          ...iso,
          storage: storage.storage,
          volid: iso.volid || `${storage.storage}:iso/${iso.name}`
        })));
      } catch (error) {
        logger.warn(`Failed to fetch ISOs from storage ${storage.storage}:`, error);
      }
    }

    return isos;
  }

  // NEW: Get templates (VMs marked as templates)
  async getTemplates(node: string): Promise<any[]> {
    await this.ensureAuthenticated();
    const vms = await this.getVMs(node);
    return vms.filter((vm: any) => vm.template === 1);
  }

  // Get the authentication ticket
  getTicket(): string | null {
    return this.ticket;
  }

  // Get CSRF token
  getCSRFToken(): string | null {
    return this.csrfToken;
  }

  // Make a generic API request
  async request(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, data?: any): Promise<any> {
    await this.ensureAuthenticated();
    const response = await this.client.request({
      method,
      url: path,
      data
    });
    return response.data?.data;
  }
}

export default ProxmoxAPI;
