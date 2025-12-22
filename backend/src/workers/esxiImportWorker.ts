// ESXi VM Import Worker - Background job processor
import { Worker, Job } from 'bullmq';
import { connection, QUEUE_NAMES } from '../config/queueConfig';
import ProxmoxESXiImportService from '../services/esxi/ProxmoxESXiImportService';
import logger from '../utils/logger';
import { logESXiImportActivity } from '../utils/activityLogger';

interface ESXiImportJobData {
  esxiHostId: number;
  clusterId: number;
  companyId: number;
  storageName: string;
  volid: string;
  vmName: string;
  options: {
    target_node: string;
    target_storage: string;
    bridge: string;
    format?: 'raw' | 'qcow2' | 'vmdk';
    vmid?: number;
    start_after_import?: boolean;
  };
  userId?: number;
}

async function processESXiImport(job: Job<ESXiImportJobData>): Promise<any> {
  const { esxiHostId, clusterId, companyId, storageName, volid, vmName, options, userId } = job.data;
  const startTime = Date.now();
  
  try {
    await job.updateProgress(5);
    logger.info(`Starting ESXi import for VM: ${vmName} from ${volid}`);

    // Log import started
    await logESXiImportActivity(
      'import_started',
      vmName,
      esxiHostId,
      clusterId,
      userId || null,
      companyId || null,
      'in_progress',
      { 
        job_id: job.id as string,
        volid,
        storage_name: storageName,
        target_node: options.target_node,
        target_storage: options.target_storage
      }
    );

    await job.updateProgress(10);

    const importService = new ProxmoxESXiImportService(
      esxiHostId,
      clusterId,
      companyId
    );

    await job.updateProgress(20);

    const result = await importService.importVM(
      volid,
      vmName,
      options,
      storageName
    );

    await job.updateProgress(90);

    const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
    logger.info(`ESXi import completed for VM: ${vmName}. VMID: ${result.vmid} in ${durationSeconds}s`);

    // Log import completed
    await logESXiImportActivity(
      'import_completed',
      vmName,
      esxiHostId,
      clusterId,
      userId || null,
      companyId || null,
      'success',
      { 
        job_id: job.id as string,
        vmid: result.vmid,
        task_id: result.task_id,
        duration_seconds: durationSeconds,
        volid,
        target_node: options.target_node
      }
    );

    await job.updateProgress(100);
    return result;

  } catch (error: any) {
    logger.error(`ESXi import failed for VM: ${vmName}:`, error);
    
    // Log import failed
    await logESXiImportActivity(
      'import_failed',
      vmName,
      esxiHostId,
      clusterId,
      userId || null,
      companyId || null,
      'failed',
      { 
        job_id: job.id as string,
        error: error.message,
        error_stack: error.stack,
        volid,
        storage_name: storageName
      }
    );
    
    throw error;
  }
}

export const esxiImportWorker = new Worker(
  QUEUE_NAMES.ESXI_IMPORT,
  processESXiImport,
  {
    connection,
    concurrency: 2,
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 50 }
  }
);

esxiImportWorker.on('completed', (job, result) => {
  logger.info(`ESXi import job ${job.id} completed. VMID: ${result?.vmid}`);
});

esxiImportWorker.on('failed', (job, error) => {
  logger.error(`ESXi import job ${job?.id} failed:`, error);
});

logger.info('ESXi Import Worker initialized');

export default esxiImportWorker;
