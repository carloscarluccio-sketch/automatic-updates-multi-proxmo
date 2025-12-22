import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';
import ProxmoxAPI from '../utils/proxmoxApi';
import { decrypt } from '../utils/encryption';
import { connection, QUEUE_NAMES } from '../config/queueConfig';
import { logISOScanActivity } from '../utils/activityLogger';

const prisma = new PrismaClient();

interface ISOScanJobData {
  clusterId: number;
  userId?: number;
}

interface ISOFile {
  volid: string;
  name: string;
  size: number;
  storage: string;
}

async function processISOScan(job: Job<ISOScanJobData>): Promise<void> {
  const { clusterId, userId } = job.data;
  const startTime = Date.now();

  try {
    logger.info(`Starting ISO scan for cluster ${clusterId}`);
    await job.updateProgress(10);

    const cluster = await prisma.proxmox_clusters.findUnique({
      where: { id: clusterId }
    });

    if (!cluster) {
      throw new Error(`Cluster ${clusterId} not found`);
    }

    // Log scan started
    await logISOScanActivity(
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

    const allISOs: ISOFile[] = [];

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const progress = 40 + Math.floor((i / nodes.length) * 30);
      await job.updateProgress(progress);

      try {
        const storages = await api.request('GET', `/nodes/${node.node}/storage`);

        const isoStorages = storages.filter((s: any) => {
          const content = s.content || '';
          return content.includes('iso');
        });

        for (const storage of isoStorages) {
          try {
            const isos = await api.request(
              'GET',
              `/nodes/${node.node}/storage/${storage.storage}/content?content=iso`
            );

            if (Array.isArray(isos)) {
              isos.forEach((iso: any) => {
                allISOs.push({
                  volid: iso.volid,
                  name: iso.volid.split('/').pop() || iso.volid,
                  size: iso.size || 0,
                  storage: storage.storage
                });
              });
            }
          } catch (storageError: any) {
            logger.warn(`Failed to get ISOs from storage ${storage.storage}:`, storageError.message);
          }
        }
      } catch (nodeError: any) {
        logger.warn(`Failed to scan node ${node.node}:`, nodeError.message);
      }
    }

    await job.updateProgress(80);

    logger.info(`Found ${allISOs.length} ISOs across all nodes`);

    await prisma.cluster_isos.deleteMany({
      where: { cluster_id: clusterId }
    });

    await job.updateProgress(85);

    if (allISOs.length > 0) {
      await prisma.cluster_isos.createMany({
        data: allISOs.map(iso => ({
          cluster_id: clusterId,
          volid: iso.volid,
          name: iso.name,
          size_bytes: iso.size,
          storage: iso.storage,
          last_scanned_at: new Date()
        }))
      });
    }

    await job.updateProgress(100);
    
    const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
    logger.info(`ISO scan completed for cluster ${clusterId}. Found ${allISOs.length} ISOs in ${durationSeconds}s`);

    // Log scan completed
    await logISOScanActivity(
      'scan_completed',
      clusterId,
      cluster.name || 'Unknown',
      userId || null,
      cluster.company_id || null,
      'success',
      { 
        job_id: job.id as string, 
        iso_count: allISOs.length, 
        duration_seconds: durationSeconds,
        nodes_scanned: nodes.length
      }
    );

  } catch (error: any) {
    logger.error(`ISO scan failed for cluster ${clusterId}:`, error);
    
    // Log scan failed
    await logISOScanActivity(
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

export const isoScanWorker = new Worker(
  QUEUE_NAMES.ISO_SCAN,
  processISOScan,
  {
    connection,
    concurrency: 3,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 100 }
  }
);

isoScanWorker.on('completed', (job) => {
  logger.info(`ISO scan job ${job.id} completed successfully`);
});

isoScanWorker.on('failed', (job, error) => {
  logger.error(`ISO scan job ${job?.id} failed:`, error);
});

logger.info('ISO Scan Worker initialized');

export default isoScanWorker;
