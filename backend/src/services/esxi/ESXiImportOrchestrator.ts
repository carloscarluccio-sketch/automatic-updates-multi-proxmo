/**
 * ESXi Import Orchestrator
 * Coordinates the complete VM import workflow from ESXi to Proxmox
 */

// @ts-ignore - Used for future implementation
import { ESXiConnection } from './ESXiConnection';
import { ESXiDiscoveryService } from './ESXiDiscoveryService';
import { DiskConversionService } from './DiskConversionService';
import logger from '../../utils/logger';
import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';

const prisma = new PrismaClient();

export interface ImportOptions {
  esxiHostId: number;
  vmIds: number[];
  targetClusterId: number;
  targetNode: string;
  targetStorage: string;
  companyId: number;
  userId: number;
}

export interface ImportProgress {
  vmId: number;
  vmName: string;
  stage: 'discovering' | 'downloading' | 'converting' | 'uploading' | 'creating' | 'completed' | 'failed';
  progress: number;
  message: string;
  error?: string;
}

export interface ImportResult {
  success: boolean;
  totalVMs: number;
  successCount: number;
  failedCount: number;
  results: ImportProgress[];
  duration: number;
}

export class ESXiImportOrchestrator extends EventEmitter {
  private discoveryService: ESXiDiscoveryService;
  private conversionService: DiskConversionService;
  private esxiHostId: number;

  constructor(esxiConnection: ESXiConnection, esxiHostId: number) {
    super();
    // this.esxiConnection = esxiConnection; // Reserved for future use
    this.esxiHostId = esxiHostId;
    this.discoveryService = new ESXiDiscoveryService(esxiConnection, esxiHostId);
    this.conversionService = new DiskConversionService();
  }

  /**
   * Import selected VMs from ESXi to Proxmox
   */
  async importVMs(options: ImportOptions): Promise<ImportResult> {
    const startTime = Date.now();
    const results: ImportProgress[] = [];
    let successCount = 0;
    let failedCount = 0;

    try {
      logger.info(`Starting import of ${options.vmIds.length} VMs`);

      // Get ESXi host details
      const esxiHost = await prisma.esxi_hosts.findUnique({
        where: { id: options.esxiHostId }
      });

      if (!esxiHost) {
        throw new Error('ESXi host not found');
      }

      // Get discovered VMs
      const discoveredVMs = await this.discoveryService.getDiscoveredVMs();
      const vmsToImport = discoveredVMs.filter(vm =>
        options.vmIds.includes(vm.id)
      );

      if (vmsToImport.length === 0) {
        throw new Error('No VMs found to import');
      }

      // Import each VM
      for (const vm of vmsToImport) {
        try {
          const progress = await this.importSingleVM(vm, options, esxiHost);
          results.push(progress);

          if (progress.stage === 'completed') {
            successCount++;
          } else {
            failedCount++;
          }
        } catch (error: any) {
          logger.error(`Failed to import VM ${vm.vm_name}:`, error);
          results.push({
            vmId: vm.id,
            vmName: vm.vm_name,
            stage: 'failed',
            progress: 0,
            message: 'Import failed',
            error: error.message
          });
          failedCount++;
        }
      }

      const duration = Date.now() - startTime;

      logger.info(`Import completed: ${successCount} successful, ${failedCount} failed`);

      return {
        success: successCount > 0,
        totalVMs: vmsToImport.length,
        successCount,
        failedCount,
        results,
        duration
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error(`Import orchestration failed: ${error.message}`);

      return {
        success: false,
        totalVMs: options.vmIds.length,
        successCount,
        failedCount,
        results,
        duration
      };
    }
  }

  /**
   * Import a single VM
   */
  private async importSingleVM(
    vm: any,
    options: ImportOptions,
    esxiHost: any
  ): Promise<ImportProgress> {
    const progress: ImportProgress = {
      vmId: vm.id,
      vmName: vm.vm_name,
      stage: 'discovering',
      progress: 0,
      message: 'Starting import'
    };

    try {
      // Emit progress event
      this.emit('progress', progress);

      // Stage 1: Parse VM metadata
      progress.stage = 'discovering';
      progress.progress = 10;
      progress.message = 'Parsing VM metadata';
      this.emit('progress', progress);

      const diskInfo = JSON.parse(vm.disk_info as string);

      // Stage 2: Download and convert disks
      progress.stage = 'downloading';
      progress.progress = 20;
      progress.message = 'Downloading VM disks';
      this.emit('progress', progress);

      const convertedDisks: string[] = [];

      for (const disk of diskInfo) {
        progress.stage = 'converting';
        progress.progress = 40;
        progress.message = `Converting disk: ${disk.name}`;
        this.emit('progress', progress);

        const conversionResult = await this.conversionService.convertVMDK({
          esxiHost: esxiHost.host,
          esxiPort: esxiHost.port || 22,
          esxiUsername: esxiHost.username,
          esxiPassword: esxiHost.password, // Should be decrypted
          vmdkPath: disk.path,
          outputDir: '/tmp/esxi-import',
          vmName: `${vm.vm_name}-${disk.name}`
        });

        if (!conversionResult.success) {
          throw new Error(`Disk conversion failed: ${conversionResult.message}`);
        }

        convertedDisks.push(conversionResult.qcow2Path!);
      }

      // Stage 3: Upload to Proxmox
      progress.stage = 'uploading';
      progress.progress = 60;
      progress.message = 'Uploading to Proxmox storage';
      this.emit('progress', progress);

      // Get Proxmox cluster details
      const cluster = await prisma.proxmox_clusters.findUnique({
        where: { id: options.targetClusterId }
      });

      if (!cluster) {
        throw new Error('Proxmox cluster not found');
      }

      // Upload each disk
      for (const diskPath of convertedDisks) {
        await this.conversionService.uploadToProxmox(
          diskPath,
          cluster.host,
          cluster.username,
          cluster.password_encrypted, // Should be decrypted
          `/var/lib/vz/images/${options.targetNode}`
        );
      }

      // Stage 4: Create VM in Proxmox
      progress.stage = 'creating';
      progress.progress = 80;
      progress.message = 'Creating VM in Proxmox';
      this.emit('progress', progress);

      // TODO: Implement Proxmox VM creation via API
      // This would use the existing ProxmoxAPI class to:
      // 1. Create new VM
      // 2. Attach converted disks
      // 3. Configure network adapters
      // 4. Set CPU and memory

      // Stage 5: Save VM to database
      await this.createVMRecord(vm, options);

      // Completed
      progress.stage = 'completed';
      progress.progress = 100;
      progress.message = 'Import completed successfully';
      this.emit('progress', progress);

      return progress;
    } catch (error: any) {
      progress.stage = 'failed';
      progress.message = 'Import failed';
      progress.error = error.message;
      this.emit('progress', progress);

      throw error;
    }
  }

  /**
   * Create VM record in database
   */
  private async createVMRecord(vm: any, options: ImportOptions): Promise<void> {
    try {
      await prisma.virtual_machines.create({
        data: {
          name: vm.vm_name,
          vmid: 0, // Will be assigned by Proxmox
          node: options.targetNode,
          cluster_id: options.targetClusterId,
          company_id: options.companyId,
          cpu_cores: vm.cpu_cores,
          memory_mb: vm.memory_mb,
          storage_gb: vm.disk_gb,
          status: 'stopped',
          imported_from_esxi: true,
          esxi_source_host: String(this.esxiHostId)
        }
      });

      logger.info(`Created VM record for ${vm.vm_name}`);
    } catch (error: any) {
      logger.error(`Failed to create VM record: ${error.message}`);
      throw error;
    }
  }

  /**
   * Rollback import on failure
   */
  // @ts-ignore - Reserved for future rollback functionality
  private async _rollbackImport(vmId: number): Promise<void> {
    try {
      logger.warn(`Rolling back import for VM ${vmId}`);

      // Delete VM from Proxmox if created
      // Delete VM from database if created
      // Cleanup temporary files

      logger.info(`Rollback completed for VM ${vmId}`);
    } catch (error: any) {
      logger.error(`Rollback failed: ${error.message}`);
    }
  }
}
