import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';
import ProxmoxAPI from '../utils/proxmoxApi';
import { decrypt } from '../utils/encryption';
import { connection, QUEUE_NAMES } from '../config/queueConfig';
import { logTemplateScanActivity } from '../utils/activityLogger';

const prisma = new PrismaClient();

interface TemplateScanJobData {
  clusterId: number;
  userId?: number;
}

interface TemplateVM {
  vmid: number;
  name: string;
  node: string;
  template: boolean;
  cpu_cores?: number;
  memory_mb?: number;
  disk_gb?: number;
}

async function processTemplateScan(job: Job<TemplateScanJobData>): Promise<void> {
  const { clusterId, userId } = job.data;
  const startTime = Date.now();

  try {
    logger.info(`Starting template scan for cluster ${clusterId}`);
    await job.updateProgress(10);

    const cluster = await prisma.proxmox_clusters.findUnique({
      where: { id: clusterId }
    });

    if (!cluster) {
      throw new Error(`Cluster ${clusterId} not found`);
    }

    // Log scan started
    await logTemplateScanActivity(
      'scan_started',
      clusterId,
      cluster.name || 'Unknown',
      userId || null,
      cluster.company_id || null,
      'in_progress',
      { job_id: job.id as string }
    );

    await job.updateProgress(20);

    const password = decrypt(cluster.password_encrypted);
    const api = new ProxmoxAPI(
      {
        host: cluster.host,
        port: cluster.port || 8006,
        username: cluster.username
      },
      password
    );

    await job.updateProgress(30);

    const nodes = await api.getNodes();
    logger.info(`Found ${nodes.length} nodes in cluster ${clusterId}`);

    await job.updateProgress(40);

    const allTemplates: TemplateVM[] = [];

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const progress = 40 + Math.floor((i / nodes.length) * 30);
      await job.updateProgress(progress);

      try {
        const vms = await api.request('GET', `/nodes/${node.node}/qemu`);

        if (Array.isArray(vms)) {
          vms.forEach((vm: any) => {
            if (vm.template === 1 || vm.template === true) {
              allTemplates.push({
                vmid: vm.vmid,
                name: vm.name,
                node: node.node,
                template: !!vm.template,
                cpu_cores: vm.cpus || vm.cores,
                memory_mb: vm.maxmem ? Math.floor(vm.maxmem / (1024 * 1024)) : undefined,
                disk_gb: vm.maxdisk ? Math.floor(vm.maxdisk / (1024 * 1024 * 1024)) : undefined
              });
            }
          });
        }
      } catch (nodeError: any) {
        logger.warn(`Failed to scan node ${node.node}:`, nodeError.message);
      }
    }

    await job.updateProgress(80);

    logger.info(`Found ${allTemplates.length} templates across all nodes`);

    await prisma.cluster_templates.deleteMany({
      where: { cluster_id: clusterId }
    });

    await job.updateProgress(85);

    if (allTemplates.length > 0) {
      await prisma.cluster_templates.createMany({
        data: allTemplates.map(tpl => ({
          cluster_id: clusterId,
          vmid: tpl.vmid,
          name: tpl.name,
          node: tpl.node,
          template: true,
          cpu_cores: tpl.cpu_cores,
          memory_mb: tpl.memory_mb,
          disk_gb: tpl.disk_gb,
          last_scanned_at: new Date()
        }))
      });
    }

    await job.updateProgress(100);
    
    const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
    logger.info(`Template scan completed for cluster ${clusterId}. Found ${allTemplates.length} templates in ${durationSeconds}s`);

    // Log scan completed
    await logTemplateScanActivity(
      'scan_completed',
      clusterId,
      cluster.name || 'Unknown',
      userId || null,
      cluster.company_id || null,
      'success',
      { 
        job_id: job.id as string, 
        template_count: allTemplates.length, 
        duration_seconds: durationSeconds,
        nodes_scanned: nodes.length
      }
    );

  } catch (error: any) {
    logger.error(`Template scan failed for cluster ${clusterId}:`, error);
    
    // Log scan failed
    await logTemplateScanActivity(
      'scan_failed',
      clusterId,
      'Unknown',
      userId || null,
      null,
      'failed',
      { 
        job_id: job.id as string, 
        error: error.message,
        error_stack: error.stack
      }
    );
    
    throw error;
  }
}

export const templateScanWorker = new Worker(
  QUEUE_NAMES.TEMPLATE_SCAN,
  processTemplateScan,
  {
    connection,
    concurrency: 3,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 100 }
  }
);

templateScanWorker.on('completed', (job) => {
  logger.info(`Template scan job ${job.id} completed successfully`);
});

templateScanWorker.on('failed', (job, error) => {
  logger.error(`Template scan job ${job?.id} failed:`, error);
});

logger.info('Template Scan Worker initialized');

export default templateScanWorker;
