// Resource Metrics Collection Service for PAYG Billing
import prisma from '../config/database';
import logger from '../utils/logger';
import { ProxmoxAPI } from '../utils/proxmoxApi';
import { decrypt } from '../utils/encryption';

interface VMMetrics {
  vmid: number;
  name: string;
  status: 'running' | 'stopped' | 'paused';
  cpus: number;
  maxmem: number;
  maxdisk: number;
  uptime: number;
  cpu?: number;
  mem?: number;
  disk?: number;
  diskread?: number;
  diskwrite?: number;
  netin?: number;
  netout?: number;
}

async function collectVMMetrics(
  proxmox: ProxmoxAPI,
  vmDatabaseId: number,
  vmid: number,
  node: string,
  companyId: number,
  clusterId: number
): Promise<void> {
  try {
    const vmStatusData = await proxmox.getVMStatus(node, vmid);
    if (!vmStatusData) return;

    const vm = vmStatusData as VMMetrics;
    const memoryPercent = vm.maxmem > 0 && vm.mem ? (vm.mem / vm.maxmem) * 100 : 0;
    const cpuUsagePercent = vm.cpu ? vm.cpu * 100 : 0;
    const memoryMb = Math.round((vm.maxmem || 0) / (1024 * 1024));
    const memoryUsedMb = Math.round((vm.mem || 0) / (1024 * 1024));
    const diskTotalGb = ((vm.maxdisk || 0) / (1024 * 1024 * 1024));
    const diskUsedGb = ((vm.disk || 0) / (1024 * 1024 * 1024));

    // Convert bytes to approximate IOPS (divide by 4KB block size), cap at INT max
    const diskReadIops = Math.min(Math.floor((vm.diskread || 0) / 4096), 2147483647);
    const diskWriteIops = Math.min(Math.floor((vm.diskwrite || 0) / 4096), 2147483647);

    let vmStatusEnum: 'running' | 'stopped' | 'paused' | 'unknown' = 'unknown';
    if (vm.status === 'running') vmStatusEnum = 'running';
    else if (vm.status === 'stopped') vmStatusEnum = 'stopped';
    else if (vm.status === 'paused') vmStatusEnum = 'paused';

    await prisma.vm_resource_metrics.create({
      data: {
        vm_id: vmDatabaseId,
        company_id: companyId,
        cluster_id: clusterId,
        cpu_cores: vm.cpus || 1,
        cpu_usage_percent: cpuUsagePercent,
        memory_mb: memoryMb,
        memory_used_mb: memoryUsedMb,
        memory_percent: memoryPercent,
        disk_total_gb: diskTotalGb,
        disk_used_gb: diskUsedGb,
        disk_read_iops: diskReadIops,
        disk_write_iops: diskWriteIops,
        network_in_bytes: BigInt(vm.netin || 0),
        network_out_bytes: BigInt(vm.netout || 0),
        vm_status: vmStatusEnum,
        uptime_seconds: BigInt(vm.uptime || 0),
        collected_at: new Date()
      }
    });

    logger.debug(`Collected metrics for VM ${vmid} (${vm.name}) on ${node}`);
  } catch (error: any) {
    logger.error(`Error collecting metrics for VM ${vmid} on ${node}:`, error.message);
  }
}

async function collectClusterMetrics(
  clusterId: number,
  clusterHost: string,
  clusterPort: number,
  username: string,
  password: string
): Promise<void> {
  try {
    logger.info(`Starting metrics collection for cluster ${clusterId} (${clusterHost})`);
    const proxmox = new ProxmoxAPI({ host: clusterHost, port: clusterPort, username }, password);
    const vms = await prisma.virtual_machines.findMany({
      where: { cluster_id: clusterId, status: { notIn: ['deleted'] } },
      select: { id: true, vmid: true, node: true, company_id: true, name: true }
    });

    for (const vm of vms) {
      await collectVMMetrics(proxmox, vm.id, vm.vmid, vm.node, vm.company_id, clusterId);
    }

    logger.info(`Completed metrics collection for cluster ${clusterId}: ${vms.length} VMs`);
  } catch (error: any) {
    logger.error(`Error collecting cluster ${clusterId} metrics:`, error.message);
  }
}

export async function collectAllMetrics(): Promise<void> {
  logger.info('========== Starting PAYG metrics collection ==========');
  try {
    const clusters = await prisma.proxmox_clusters.findMany({
      where: { status: 'active' },
      select: { id: true, name: true, host: true, port: true, username: true, password_encrypted: true }
    });

    for (const cluster of clusters) {
      try {
        const password = decrypt(cluster.password_encrypted);
        await collectClusterMetrics(cluster.id, cluster.host, cluster.port || 8006, cluster.username, password);
      } catch (error: any) {
        logger.error(`Failed to process cluster ${cluster.id}:`, error.message);
      }
    }
    logger.info('========== Metrics collection completed ==========');
  } catch (error: any) {
    logger.error('Error in metrics collection:', error);
    throw error;
  }
}

export async function cleanupOldMetrics(): Promise<void> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);
    const result = await prisma.vm_resource_metrics.deleteMany({
      where: { collected_at: { lt: cutoffDate } }
    });
    logger.info(`Deleted ${result.count} old metric records`);
  } catch (error: any) {
    logger.error('Error cleaning up old metrics:', error);
  }
}

export default { collectAllMetrics, cleanupOldMetrics };
