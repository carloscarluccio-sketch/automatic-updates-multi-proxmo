import { PrismaClient } from '@prisma/client';
import logger from '../../utils/logger';
import ProxmoxAPI from '../../utils/proxmoxApi';
import { decrypt } from '../../utils/encryption';

const prisma = new PrismaClient();

export interface ESXiStorageConfig {
  storage_name: string;
  server: string;
  username: string;
  password: string;
  skip_cert_verification?: boolean;
}

export interface ProxmoxImportableVM {
  volid: string;
  vmid_suggestion?: number;
  name: string;
  guest_os: string;
  cpu_count: number;
  memory_mb: number;
  disk_count: number;
  disk_size_gb: number;
}

export interface VMImportOptions {
  target_storage: string;
  target_node: string;
  vmid?: number;
  bridge: string;
  format?: 'raw' | 'qcow2' | 'vmdk';
  start_after_import?: boolean;
}

export interface ImportProgress {
  task_id: string;
  status: 'running' | 'completed' | 'failed';
  progress_percent: number;
  message?: string;
}

export class ProxmoxESXiImportService {
  private esxiHostId: number;
  private clusterId: number;
  private companyId: number;

  constructor(esxiHostId: number, clusterId: number, companyId: number) {
    this.esxiHostId = esxiHostId;
    this.clusterId = clusterId;
    this.companyId = companyId;
  }

  private async getProxmoxAPI(): Promise<ProxmoxAPI> {
    const cluster = await prisma.proxmox_clusters.findUnique({
      where: { id: this.clusterId }
    });

    if (!cluster) {
      throw new Error(`Cluster ${this.clusterId} not found`);
    }

    const password = decrypt(cluster.password_encrypted);
    return new ProxmoxAPI(
      {
        host: cluster.host,
        port: cluster.port || 8006,
        username: cluster.username
      },
      password
    );
  }

  async addESXiStorage(config: ESXiStorageConfig): Promise<string> {
    try {
      logger.info(`Adding ESXi storage: ${config.storage_name}`);

      const api = await this.getProxmoxAPI();

      const storageData = {
        storage: config.storage_name,
        type: 'esxi',
        server: config.server,
        username: config.username,
        password: config.password,
        'skip-cert-verification': config.skip_cert_verification ? 1 : 0,
        content: 'import'
      };

      await api.request('POST', '/storage', storageData);

      logger.info(`ESXi storage added successfully: ${config.storage_name}`);
      return config.storage_name;
    } catch (error: any) {
      logger.error('Failed to add ESXi storage:', error);
      throw new Error(`Failed to add ESXi storage: ${error.message}`);
    }
  }

  async listImportableVMs(storageName: string): Promise<ProxmoxImportableVM[]> {
    try {
      logger.info(`Listing importable VMs from storage: ${storageName}`);

      const api = await this.getProxmoxAPI();

      const nodes = await api.getNodes();
      if (!nodes || nodes.length === 0) {
        throw new Error('No nodes found in cluster');
      }

      const nodeName = nodes[0].node;
      logger.info(`Using node: ${nodeName}`);

      const contentResponse = await api.request(
        'GET',
        `/nodes/${nodeName}/storage/${storageName}/content`
      );

      if (!contentResponse || !Array.isArray(contentResponse)) {
        throw new Error('Failed to list storage content');
      }

      const vmxFiles = contentResponse.filter((item: any) => item.format === 'vmx');
      logger.info(`Found ${vmxFiles.length} VMX files on ESXi storage`);

      if (vmxFiles.length === 0) {
        return [];
      }

      const importableVMs: ProxmoxImportableVM[] = [];

      for (const vmxFile of vmxFiles) {
        try {
          const volumePath = vmxFile.volid.split(':')[1];
          logger.info(`Processing VM: ${volumePath}`);

          const metadata = await api.request(
            'GET',
            `/nodes/${nodeName}/storage/${storageName}/import-metadata?volume=${encodeURIComponent(volumePath)}`
          );

          if (!metadata) {
            logger.warn(`Failed to get metadata for ${volumePath}`);
            continue;
          }

          const createArgs = metadata['create-args'] || {};
          const disks = metadata.disks || {};

          let totalDiskSizeBytes = 0;
          Object.keys(disks).forEach(key => {
            if (key !== 'efidisk0' && disks[key].size) {
              totalDiskSizeBytes += disks[key].size;
            }
          });
          const totalDiskSizeGB = totalDiskSizeBytes / (1024 * 1024 * 1024);

          importableVMs.push({
            volid: volumePath,
            vmid_suggestion: undefined,
            name: createArgs.name || volumePath.split('/').pop()?.replace('.vmx', '') || 'Unknown',
            guest_os: createArgs.ostype || 'other',
            cpu_count: (createArgs.sockets || 1) * (createArgs.cores || 1),
            memory_mb: createArgs.memory || 512,
            disk_count: Object.keys(disks).filter(k => k !== 'efidisk0').length,
            disk_size_gb: Math.round(totalDiskSizeGB * 100) / 100
          });
        } catch (err: any) {
          logger.error(`Failed to process VM ${vmxFile.volid}:`, err.message);
        }
      }

      logger.info(`Successfully parsed ${importableVMs.length} importable VMs`);
      return importableVMs;
    } catch (error: any) {
      logger.error('Failed to list importable VMs:', error);
      throw new Error(`Failed to list importable VMs: ${error.message}`);
    }
  }

  async importVM(
    volid: string,
    vmName: string,
    options: VMImportOptions,
    storageName: string
  ): Promise<{ vmid: number; task_id: string }> {
    try {
      logger.info(`Starting import of VM: ${vmName} from ${volid}`);

      const api = await this.getProxmoxAPI();
      const cluster = await prisma.proxmox_clusters.findUnique({
        where: { id: this.clusterId }
      });

      if (!cluster) {
        throw new Error(`Cluster ${this.clusterId} not found`);
      }

      const nodes = await api.getNodes();
      const nodeName = options.target_node || nodes[0].node;

      // Step 1: Get VM metadata
      logger.info(`Fetching metadata for ${volid}`);
      const metadata = await api.request(
        'GET',
        `/nodes/${nodeName}/storage/${storageName}/import-metadata?volume=${encodeURIComponent(volid)}`
      );

      if (!metadata) {
        throw new Error(`Failed to get metadata for VM ${volid}`);
      }

      const createArgs = metadata['create-args'] || {};
      const disks = metadata.disks || {};
      const net = metadata.net || {};

      // Step 2: Get next VMID
      let vmid = options.vmid;
      if (!vmid) {
        const nextIdResponse = await api.request('GET', '/cluster/nextid');
        vmid = parseInt(nextIdResponse);
      }

      logger.info(`Creating VM ${vmid} with name ${vmName}`);

      // Step 3: Build VM configuration with import-from disks
      const vmConfig: any = {
        vmid: vmid,
        name: vmName,
        ostype: createArgs.ostype || 'other',
        cores: createArgs.cores || 1,
        sockets: createArgs.sockets || 1,
        memory: createArgs.memory || 512,
        scsihw: createArgs.scsihw || 'virtio-scsi-pci',
        bios: createArgs.bios || 'seabios',
        boot: 'order=scsi0',
        agent: '1'
      };

      // Add network config
      if (net.net0) {
        vmConfig.net0 = `${net.net0.model || 'virtio'},bridge=${options.bridge}${net.net0.macaddr ? ',macaddr=' + net.net0.macaddr : ''}`;
      } else {
        vmConfig.net0 = `virtio,bridge=${options.bridge}`;
      }

      // Step 4: Add disks with import-from directive (Proxmox 9.1+ method)
      let diskIndex = 0;
      for (const [diskKey, diskData] of Object.entries(disks)) {
        if (diskKey === 'efidisk0') {
          // Handle EFI disk if present
          if (diskData && typeof diskData === 'object' && 'volid' in diskData) {
            vmConfig.efidisk0 = `${options.target_storage}:0,efitype=4m,pre-enrolled-keys=1,import-from=${(diskData as any).volid}`;
          }
          continue;
        }
        if (!diskData || typeof diskData !== 'object' || !('volid' in diskData)) continue;

        const diskVolid = (diskData as any).volid;
        const scsiKey = `scsi${diskIndex}`;
        vmConfig[scsiKey] = `${options.target_storage}:0,import-from=${diskVolid}`;
        logger.info(`Added disk ${scsiKey} with import-from=${diskVolid}`);
        diskIndex++;
      }

      logger.info(`Creating VM with ${diskIndex} disks for import`);
      logger.info(`VM config: ${JSON.stringify(vmConfig, null, 2)}`);

      // Step 5: Create VM - Proxmox API will handle the disk imports automatically
      const createResponse = await api.request(
        'POST',
        `/nodes/${nodeName}/qemu`,
        vmConfig
      );

      const taskId = createResponse || `import-${vmid}-${Date.now()}`;

      logger.info(`VM ${vmid} created successfully with taskId ${taskId}`);

      // Step 6: Start VM if requested
      if (options.start_after_import) {
        logger.info(`Starting VM ${vmid}`);
        await api.request('POST', `/nodes/${nodeName}/qemu/${vmid}/status/start`);
      }

      // Save import record
      await this.saveImportRecord(vmid, vmName, volid, options, String(taskId));

      logger.info(`VM import completed: VMID=${vmid}`);

      return { vmid, task_id: String(taskId) };
    } catch (error: any) {
      logger.error('Failed to import VM:', error);
      throw new Error(`Failed to import VM: ${error.message}`);
    }
  }

  async getImportProgress(taskId: string, nodeName: string): Promise<ImportProgress> {
    try {
      const api = await this.getProxmoxAPI();

      const response = await api.request(
        'GET',
        `/nodes/${nodeName}/tasks/${taskId}/status`
      );

      if (!response) {
        throw new Error('Failed to get task status');
      }

      const status = response.status;
      const exitStatus = response.exitstatus;

      let taskStatus: 'running' | 'completed' | 'failed' = 'running';
      if (status === 'stopped') {
        taskStatus = exitStatus === 'OK' ? 'completed' : 'failed';
      }

      return {
        task_id: taskId,
        status: taskStatus,
        progress_percent: this.calculateProgress(response),
        message: response.log || ''
      };
    } catch (error: any) {
      logger.error('Failed to get import progress:', error);
      throw new Error(`Failed to get import progress: ${error.message}`);
    }
  }

  async removeESXiStorage(storageName: string): Promise<void> {
    try {
      logger.info(`Removing ESXi storage: ${storageName}`);

      const api = await this.getProxmoxAPI();
      await api.request('DELETE', `/storage/${storageName}`);

      logger.info(`ESXi storage removed: ${storageName}`);
    } catch (error: any) {
      logger.error('Failed to remove ESXi storage:', error);
    }
  }

  private calculateProgress(taskStatus: any): number {
    if (taskStatus.status === 'stopped') {
      return 100;
    }

    const log = taskStatus.log || '';
    const progressMatch = log.match(/(\d+)%/);
    if (progressMatch) {
      return parseInt(progressMatch[1]);
    }

    return 0;
  }

  private async saveImportRecord(
    vmid: number,
    vmName: string,
    volid: string,
    options: VMImportOptions,
    taskId: string
  ): Promise<void> {
    try {
      await prisma.virtual_machines.create({
        data: {
          company_id: this.companyId,
          cluster_id: this.clusterId,
          node: options.target_node,
          vmid: vmid,
          name: vmName,
          status: 'unknown',
          cpu_cores: 1,
          memory_mb: 512,
          storage_gb: 0
        }
      });

      await prisma.esxi_discovered_vms.create({
        data: {
          esxi_host_id: this.esxiHostId,
          vm_name: vmName,
          vm_path: volid,
          power_state: 'POWERED_OFF',
          cpu_cores: 1,
          memory_mb: 512,
          disk_gb: 0,
          guest_os: 'Unknown',
          network_adapters: '[]',
          disk_info: '[]',
          metadata: JSON.stringify({
            proxmox_vmid: vmid,
            proxmox_node: options.target_node,
            proxmox_storage: options.target_storage,
            import_task_id: taskId,
            import_status: 'running'
          })
        }
      });

      logger.info(`Import record saved for VM ${vmName} (VMID: ${vmid})`);
    } catch (error: any) {
      logger.error('Failed to save import record:', error);
    }
  }
}

export default ProxmoxESXiImportService;
