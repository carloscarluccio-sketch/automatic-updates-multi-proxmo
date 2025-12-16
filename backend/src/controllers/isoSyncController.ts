import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../config/database';
import logger from '../utils/logger';
import axios from 'axios';
import https from 'https';
import { decrypt } from '../utils/encryption';

/**
 * ISO Sync Controller
 * Handles syncing ISO images between multiple Proxmox clusters
 */

interface ProxmoxCluster {
  id: number;
  host: string;
  port: number;
  username: string;
  password_encrypted: string;
  realm: string;
}

interface ISOSyncJob {
  id: string;
  sourceIsoId: number;
  sourceClusterId: number;
  targetClusterIds: number[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  results: Array<{
    clusterId: number;
    status: 'pending' | 'success' | 'failed';
    message?: string;
    isoId?: number;
  }>;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

// In-memory store for sync jobs (in production, use database)
const syncJobs: Map<string, ISOSyncJob> = new Map();

/**
 * Get Proxmox ticket for authentication
 */
async function getProxmoxTicket(cluster: ProxmoxCluster): Promise<string> {
  const password = decrypt(cluster.password_encrypted);

  const response = await axios.post(
    `https://${cluster.host}:${cluster.port}/api2/json/access/ticket`,
    {
      username: `${cluster.username}@${cluster.realm}`,
      password
    },
    {
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    }
  );

  if (!response.data || !response.data.data || !response.data.data.ticket) {
    throw new Error('Failed to get Proxmox authentication ticket');
  }

  return response.data.data.ticket;
}

/**
 * Download ISO from source cluster
 */
async function downloadISO(
  cluster: any,
  _node: string,
  _storage: string,
  filename: string,
  _ticket: string
): Promise<Buffer> {
  const child_process = require('child_process');
  const fs = require('fs');
  const path = require('path');
  const { decrypt } = require('../utils/encryption');

  const password = decrypt(cluster.password_encrypted);
  const remotePath = `/var/lib/vz/template/iso/${filename}`;
  const tempFile = path.join('/tmp', `iso-download-${Date.now()}-${filename}`);

  const scpCommand = `sshpass -p '${password}' scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -P 22 "${cluster.username.replace('@pam', '')}@${cluster.host}:${remotePath}" "${tempFile}"`;

  return new Promise((resolve, reject) => {
    child_process.exec(scpCommand, { maxBuffer: 1024 * 1024 * 1024 }, (error: any, stdout: any, stderr: any) => {
      if (error) {
        logger.error('SCP download error:', { error: error.message, stderr });
        try { fs.unlinkSync(tempFile); } catch(e) {}
        reject(new Error(`Failed to download ISO via SCP: ${stderr || error.message}`));
        return;
      }
      try {
        const fileBuffer = fs.readFileSync(tempFile);
        fs.unlinkSync(tempFile);
        resolve(fileBuffer);
      } catch (readError) {
        logger.error('Failed to read downloaded ISO:', readError);
        reject(new Error('Failed to read downloaded ISO file'));
      }
    });
  });
}

/**
 * Upload ISO to target cluster
 */
async function uploadISO(
  cluster: any,
  _node: string,
  _storage: string,
  filename: string,
  content: Buffer,
  _ticket: string
): Promise<void> {
  const child_process = require('child_process');
  const fs = require('fs');
  const path = require('path');
  const { decrypt } = require('../utils/encryption');

  const password = decrypt(cluster.password_encrypted);
  const tempFile = path.join('/tmp', `iso-upload-${Date.now()}-${filename}`);
  fs.writeFileSync(tempFile, content);

  const remotePath = `/var/lib/vz/template/iso/${filename}`;
  const scpCommand = `sshpass -p '${password}' scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -P 22 "${tempFile}" "${cluster.username.replace('@pam', '')}@${cluster.host}:${remotePath}"`;

  return new Promise((resolve, reject) => {
    child_process.exec(scpCommand, (error: any, stdout: any, stderr: any) => {
      fs.unlinkSync(tempFile);
      if (error) {
        logger.error('SCP upload error:', { error: error.message, stderr });
        reject(new Error(`Failed to upload ISO via SCP: ${stderr || error.message}`));
        return;
      }
      resolve();
    });
  });
}

/**
 * Start ISO sync job
 */
export const startISOSync = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { isoId, targetClusterIds, targetStorage, targetNode } = req.body;
    const { role, company_id } = req.user!;

    if (!isoId || !targetClusterIds || !Array.isArray(targetClusterIds) || targetClusterIds.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: isoId, targetClusterIds (array)'
      });
      return;
    }

    // Get source ISO
    const iso = await prisma.isos.findUnique({
      where: { id: Number(isoId) }
    });

    if (!iso) {
      res.status(404).json({ success: false, message: 'Source ISO not found' });
      return;
    }

    // Permission check
    if (role !== 'super_admin' && iso.company_id !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    // Get source cluster
    const sourceCluster = await prisma.proxmox_clusters.findUnique({
      where: { id: iso.cluster_id }
    });

    if (!sourceCluster) {
      res.status(404).json({ success: false, message: 'Source cluster not found' });
      return;
    }

    // Validate target clusters
    const targetClusters = await prisma.proxmox_clusters.findMany({
      where: {
        id: { in: targetClusterIds.map((id: any) => Number(id)) }
      }
    });

    if (targetClusters.length !== targetClusterIds.length) {
      res.status(400).json({ success: false, message: 'One or more target clusters not found' });
      return;
    }

    // Create sync job
    const jobId = `iso-sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const syncJob: ISOSyncJob = {
      id: jobId,
      sourceIsoId: iso.id,
      sourceClusterId: iso.cluster_id,
      targetClusterIds: targetClusterIds.map((id: any) => Number(id)),
      status: 'pending',
      progress: 0,
      results: targetClusterIds.map((id: any) => ({
        clusterId: Number(id),
        status: 'pending'
      }))
    };

    syncJobs.set(jobId, syncJob);
    // Persist to database
    database.iso_sync_jobs.create({
      data: {
        id: jobId,
        iso_id: iso.id,
        source_cluster_id: iso.cluster_id,
        target_cluster_ids: JSON.stringify(targetClusterIds),
        status: 'pending',
        progress: 0,
        results: JSON.stringify(syncJob.results)
      }
    }).catch(err => logger.error('Failed to persist sync job:', err));

    // Start async sync process
    processISOSync(jobId, iso, sourceCluster, targetClusters, targetStorage, targetNode, req.user!.id).catch(error => {
      logger.error(`ISO sync job ${jobId} failed:`, error);
      const job = syncJobs.get(jobId);
      if (job) {
        job.status = 'failed';
        job.error = error.message;
        job.completedAt = new Date();
      }
    });

    res.status(202).json({
      data: syncJob,
      success: true
    });
  } catch (error) {
    logger.error('Start ISO sync error:', error);
    res.status(500).json({ success: false, message: 'Failed to start ISO sync' });
  }
};

/**
 * Process ISO sync job asynchronously
 */
async function processISOSync(
  jobId: string,
  iso: any,
  sourceCluster: any,
  targetClusters: any[],
  targetStorage: string,
  targetNode: string,
  userId: number
): Promise<void> {
  const job = syncJobs.get(jobId);
  if (!job) return;

  job.status = 'in_progress';
  job.startedAt = new Date();

  try {
    // Get source cluster ticket
    // const sourceTicket = await getProxmoxTicket(sourceCluster); // Not needed for SSH/SCP

    // Download ISO from source
    logger.info(`Downloading ISO ${iso.filename} from cluster ${sourceCluster.name}`);
    const isoContent = await downloadISO(sourceCluster, iso.node, iso.storage, iso.filename, "");

    job.progress = 10;

    // Upload to each target cluster
    const progressIncrement = 90 / targetClusters.length;

    for (let i = 0; i < targetClusters.length; i++) {
      const targetCluster = targetClusters[i];
      const resultIndex = job.results.findIndex(r => r.clusterId === targetCluster.id);

      try {
        logger.info(`Uploading ISO to cluster ${targetCluster.name}`);

        // Get target cluster ticket
        // const "" = await getProxmoxTicket(targetCluster); // Not needed for SSH/SCP

        // For SSH/SCP, node doesn't matter - use source node or 'pve' as default
        let uploadNode = targetNode || iso.node || 'pve';

        // Upload ISO
        await uploadISO(
          targetCluster,
          uploadNode,
          targetStorage || iso.storage,
          iso.filename,
          isoContent,
          ""
        );

        // Create ISO record in database
        const newIso = await prisma.isos.create({
          data: {
            name: iso.name,
            filename: iso.filename,
            size_bytes: iso.size_bytes,
            cluster_id: targetCluster.id,
            storage: targetStorage || iso.storage,
            node: uploadNode,
            company_id: iso.company_id,
            is_default: iso.is_default,
            description: `Synced from cluster ${sourceCluster.name}`,
            uploaded_by: userId
          }
        });

        if (resultIndex >= 0) {
          job.results[resultIndex].status = 'success';
          job.results[resultIndex].message = 'ISO synced successfully';
          job.results[resultIndex].isoId = newIso.id;
        }

        logger.info(`ISO synced to cluster ${targetCluster.name}, new ISO ID: ${newIso.id}`);
      } catch (error: any) {
        logger.error(`Failed to sync ISO to cluster ${targetCluster.name}:`, error);
        if (resultIndex >= 0) {
          job.results[resultIndex].status = 'failed';
          job.results[resultIndex].message = error.message || 'Unknown error';
        }
      }

      job.progress = 10 + (i + 1) * progressIncrement;
        await database.iso_sync_jobs.update({
          where: { id: jobId },
          data: {
            progress: Math.floor(job.progress),
            results: JSON.stringify(job.results)
          }
        }).catch(err => logger.error('Failed to update progress:', err));
    }

    // Check if all succeeded
    const allSucceeded = job.results.every(r => r.status === 'success');
    job.status = allSucceeded ? 'completed' : 'failed';
    job.progress = 100;
    job.completedAt = new Date();
    await database.iso_sync_jobs.update({
      where: { id: jobId },
      data: {
        status: job.status,
        progress: 100,
        results: JSON.stringify(job.results),
        completed_at: job.completedAt
      }
    }).catch(err => logger.error('Failed to update completion:', err));

    logger.info(`ISO sync job ${jobId} completed with status: ${job.status}`);
  } catch (error: any) {
    logger.error(`ISO sync job ${jobId} failed:`, error);
    job.status = 'failed';
    job.error = error.message;
    job.completedAt = new Date();
  }
}

/**
 * Get ISO sync job status
 */
export const getISOSyncStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { jobId } = req.params;

    let job = syncJobs.get(jobId);
    if (!job) {
      // Check database for completed jobs
      const dbJob = await database.iso_sync_jobs.findUnique({
        where: { id: jobId }
      });
      if (dbJob) {
        job = {
          id: dbJob.id,
          sourceIsoId: dbJob.iso_id,
          sourceClusterId: dbJob.source_cluster_id,
          targetClusterIds: JSON.parse(dbJob.target_cluster_ids),
          status: dbJob.status,
          progress: dbJob.progress,
          results: JSON.parse(dbJob.results || '[]'),
          completedAt: dbJob.completed_at,
          error: dbJob.error
        };
      } else {
        res.status(404).json({ success: false, message: 'Sync job not found' });
        return;
      }
    }

    res.json({ success: true, data: job });
  } catch (error) {
    logger.error('Get ISO sync status error:', error);
    res.status(500).json({ success: false, message: 'Failed to get sync status' });
  }
};

/**
 * Get all ISO sync jobs
 */
export const getISOSyncJobs = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const jobs = Array.from(syncJobs.values()).sort((a, b) => {
      return (b.startedAt?.getTime() || 0) - (a.startedAt?.getTime() || 0);
    });

    res.json({ success: true, data: jobs });
  } catch (error) {
    logger.error('Get ISO sync jobs error:', error);
    res.status(500).json({ success: false, message: 'Failed to get sync jobs' });
  }
};

/**
 * Cancel ISO sync job
 */
export const cancelISOSync = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { jobId } = req.params;

    let job = syncJobs.get(jobId);
    if (!job) {
      // Check database for completed jobs
      const dbJob = await database.iso_sync_jobs.findUnique({
        where: { id: jobId }
      });
      if (dbJob) {
        job = {
          id: dbJob.id,
          sourceIsoId: dbJob.iso_id,
          sourceClusterId: dbJob.source_cluster_id,
          targetClusterIds: JSON.parse(dbJob.target_cluster_ids),
          status: dbJob.status,
          progress: dbJob.progress,
          results: JSON.parse(dbJob.results || '[]'),
          completedAt: dbJob.completed_at,
          error: dbJob.error
        };
      } else {
        res.status(404).json({ success: false, message: 'Sync job not found' });
        return;
      }
    }

    if (job.status === 'completed' || job.status === 'failed') {
      res.status(400).json({ success: false, message: 'Cannot cancel completed or failed job' });
      return;
    }

    // Mark as failed (actual cancellation would require more complex state management)
    job.status = 'failed';
    job.error = 'Cancelled by user';
    job.completedAt = new Date();

    logger.info(`ISO sync job ${jobId} cancelled`);
    res.json({ success: true, message: 'Sync job cancelled' });
  } catch (error) {
    logger.error('Cancel ISO sync error:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel sync job' });
  }
};
