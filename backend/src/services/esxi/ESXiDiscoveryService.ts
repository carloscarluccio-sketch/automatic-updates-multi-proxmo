/**
 * ESXi VM Discovery Service
 * Discovers and retrieves VM metadata from ESXi hosts
 */

import { ESXiConnection } from './ESXiConnection';
import logger from '../../utils/logger';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface DiscoveredVM {
  name: string;
  vmPath: string;
  powerState: string;
  cpuCores: number;
  memoryMB: number;
  diskGB: number;
  guestOS: string;
  networkAdapters: NetworkAdapter[];
  diskInfo: DiskInfo[];
  metadata: Record<string, any>;
}

export interface NetworkAdapter {
  name: string;
  macAddress: string;
  ipAddress?: string;
  network: string;
}

export interface DiskInfo {
  name: string;
  sizeGB: number;
  path: string;
  type: string;
}

export class ESXiDiscoveryService {
  private connection: ESXiConnection;
  private esxiHostId: number;

  constructor(connection: ESXiConnection, esxiHostId: number) {
    this.connection = connection;
    this.esxiHostId = esxiHostId;
  }

  /**
   * Discover all VMs on the ESXi host
   */
  async discoverVMs(): Promise<DiscoveredVM[]> {
    try {
      logger.info('Starting VM discovery on ESXi host');

      if (!this.connection.isConnected()) {
        await this.connection.connect();
      }

      const client = this.connection.getClient();

      // Retrieve all VMs
      const vms = await client.retrieve({
        type: 'VirtualMachine',
        properties: ['name', 'config', 'runtime', 'guest', 'summary']
      });

      const discoveredVMs: DiscoveredVM[] = [];

      // Clear old discovered VMs for this host
      await prisma.esxi_discovered_vms.deleteMany({
        where: { esxi_host_id: this.esxiHostId }
      });

      if (Array.isArray(vms)) {
        for (const vm of vms) {
          try {
            const discoveredVM = await this.extractVMMetadata(vm);
            discoveredVMs.push(discoveredVM);

            // Save to database
            await this.saveDiscoveredVM(discoveredVM);
          } catch (error: any) {
            logger.error(`Failed to process VM ${vm.name}:`, error);
          }
        }
      }

      logger.info(`Discovered ${discoveredVMs.length} VMs`);
      return discoveredVMs;
    } catch (error: any) {
      logger.error('VM discovery failed:', error);
      throw new Error(`VM discovery failed: ${error.message}`);
    }
  }

  /**
   * Extract metadata from a VM object
   */
  private async extractVMMetadata(vm: any): Promise<DiscoveredVM> {
    const config = vm.config || {};
    const runtime = vm.runtime || {};
    const guest = vm.guest || {};

    // Extract CPU and memory
    const cpuCores = config.hardware?.numCPU || 0;
    const memoryMB = config.hardware?.memoryMB || 0;

    // Extract disk information
    const diskInfo: DiskInfo[] = [];
    let totalDiskGB = 0;

    if (config.hardware?.device) {
      for (const device of config.hardware.device) {
        if (device._type === 'VirtualDisk') {
          const sizeGB = Math.round((device.capacityInKB || 0) / 1024 / 1024 * 100) / 100;
          totalDiskGB += sizeGB;

          diskInfo.push({
            name: device.deviceInfo?.label || 'Unknown',
            sizeGB,
            path: device.backing?.fileName || '',
            type: device.backing?._type || 'Unknown'
          });
        }
      }
    }

    // Extract network adapters
    const networkAdapters: NetworkAdapter[] = [];

    if (config.hardware?.device) {
      for (const device of config.hardware.device) {
        if (device._type?.includes('VirtualEthernet')) {
          networkAdapters.push({
            name: device.deviceInfo?.label || 'Unknown',
            macAddress: device.macAddress || '',
            network: device.backing?.deviceName || device.backing?.network?.name || 'Unknown',
            ipAddress: undefined
          });
        }
      }
    }

    // Try to get IP addresses from guest tools
    if (guest.net) {
      for (const guestNet of guest.net) {
        const macAddress = guestNet.macAddress;
        const adapter = networkAdapters.find(a => a.macAddress === macAddress);

        if (adapter && guestNet.ipAddress && guestNet.ipAddress.length > 0) {
          const ipv4 = guestNet.ipAddress.find((ip: string) => !ip.includes(':'));
          adapter.ipAddress = ipv4 || guestNet.ipAddress[0];
        }
      }
    }

    return {
      name: vm.name || 'Unknown',
      vmPath: config.files?.vmPathName || '',
      powerState: runtime.powerState || 'unknown',
      cpuCores,
      memoryMB,
      diskGB: totalDiskGB,
      guestOS: config.guestFullName || config.guestId || 'Unknown',
      networkAdapters,
      diskInfo,
      metadata: {
        uuid: config.uuid,
        instanceUuid: config.instanceUuid,
        version: config.version,
        annotation: config.annotation,
        tools: {
          status: guest.toolsStatus,
          version: guest.toolsVersion,
          running: guest.toolsRunningStatus
        }
      }
    };
  }

  /**
   * Save discovered VM to database
   */
  private async saveDiscoveredVM(vm: DiscoveredVM): Promise<void> {
    try {
      await prisma.esxi_discovered_vms.create({
        data: {
          esxi_host_id: this.esxiHostId,
          vm_name: vm.name,
          vm_path: vm.vmPath,
          power_state: vm.powerState,
          cpu_cores: vm.cpuCores,
          memory_mb: vm.memoryMB,
          disk_gb: vm.diskGB,
          guest_os: vm.guestOS,
          network_adapters: JSON.stringify(vm.networkAdapters),
          disk_info: JSON.stringify(vm.diskInfo),
          metadata: JSON.stringify(vm.metadata)
        }
      });
    } catch (error: any) {
      logger.error(`Failed to save discovered VM ${vm.name}:`, error);
      throw error;
    }
  }

  /**
   * Get discovered VMs from database
   */
  async getDiscoveredVMs(): Promise<any[]> {
    try {
      const vms = await prisma.esxi_discovered_vms.findMany({
        where: {
          esxi_host_id: this.esxiHostId
        },
        orderBy: {
          discovered_at: 'desc'
        }
      });

      return vms.map(vm => ({
        ...vm,
        network_adapters: JSON.parse(vm.network_adapters as string),
        disk_info: JSON.parse(vm.disk_info as string),
        metadata: JSON.parse(vm.metadata as string)
      }));
    } catch (error: any) {
      logger.error('Failed to retrieve discovered VMs:', error);
      throw error;
    }
  }
}
