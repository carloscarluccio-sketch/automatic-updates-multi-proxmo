// Jobs Controller - API for background job status and management
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';
import { queues } from '../config/queueConfig';
import { logJobActivity } from '../utils/activityLogger';

// @ts-ignore unused
const _prisma = new PrismaClient();

/**
 * Get job status by ID
 * GET /api/jobs/:jobId/status
 */
export const getJobStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { jobId } = req.params;
    
    // Check all queues for this job
    let job = await queues.isoScan.getJob(jobId);
    if (!job) job = await queues.templateScan.getJob(jobId);
    if (!job) job = await queues.esxiImport.getJob(jobId);
    if (!job) job = await queues.vmDiscovery.getJob(jobId);

    if (!job) {
      res.status(404).json({
        success: false,
        message: 'Job not found'
      });
      return;
    }

    const state = await job.getState();
    const progress = job.progress as number || 0;

    res.json({
      success: true,
      job: {
        id: job.id,
        name: job.name,
        data: job.data,
        progress: progress,
        status: state,
        returnValue: job.returnvalue,
        failedReason: job.failedReason,
        finishedOn: job.finishedOn,
        processedOn: job.processedOn
      }
    });

  } catch (error: any) {
    logger.error('Failed to get job status:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get job status'
    });
  }
};

/**
 * List jobs with filters
 * GET /api/jobs?status=active&type=iso_scan&limit=50
 */
export const listJobs = async (req: Request, res: Response): Promise<void> => {
  try {
    // @ts-ignore
const _user = (req as any).user;
    const { status, type, limit = 50 } = req.query;

    let jobs: any[] = [];

    // Determine which queue to query
    if (!type || type === 'iso_scan') {
      const isoJobs = await queues.isoScan.getJobs(
        status as any || ['waiting', 'active', 'completed', 'failed'],
        0,
        parseInt(limit as string)
      );
      jobs = jobs.concat(isoJobs.map(j => ({ ...j, type: 'iso_scan' })));
    }

    if (!type || type === 'template_scan') {
      const templateJobs = await queues.templateScan.getJobs(
        status as any || ['waiting', 'active', 'completed', 'failed'],
        0,
        parseInt(limit as string)
      );
      jobs = jobs.concat(templateJobs.map(j => ({ ...j, type: 'template_scan' })));
    }

    if (!type || type === 'esxi_import') {
      const esxiJobs = await queues.esxiImport.getJobs(
        status as any || ['waiting', 'active', 'completed', 'failed'],
        0,
        parseInt(limit as string)
      );
      jobs = jobs.concat(esxiJobs.map(j => ({ ...j, type: 'esxi_import' })));
    }

    // Format response
    const formattedJobs = await Promise.all(jobs.map(async (job) => {
      const state = await job.getState();
      return {
        id: job.id,
        type: job.type,
        name: job.name,
        data: job.data,
        progress: job.progress || 0,
        status: state,
        finishedOn: job.finishedOn,
        processedOn: job.processedOn
      };
    }));

    res.json({
      success: true,
      jobs: formattedJobs
    });

  } catch (error: any) {
    logger.error('Failed to list jobs:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to list jobs'
    });
  }
};

/**
 * Cancel/remove a job
 * DELETE /api/jobs/:jobId
 */
export const cancelJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const { jobId } = req.params;
    
    let job = await queues.isoScan.getJob(jobId);
    if (!job) job = await queues.templateScan.getJob(jobId);
    if (!job) job = await queues.esxiImport.getJob(jobId);
    if (!job) job = await queues.vmDiscovery.getJob(jobId);

    if (!job) {
      res.status(404).json({
        success: false,
        message: 'Job not found'
      });
      return;
    }

    await job.remove();

    // Log job cancelled
    const user = (req as any).user;
    const jobType = job.queueName.includes('iso') ? 'iso_scan' : 
                    job.queueName.includes('template') ? 'template_scan' : 
                    job.queueName.includes('esxi') ? 'esxi_import' : 'vm_discovery';
    
    await logJobActivity(
      'cancelled',
      jobType as any,
      jobId,
      user?.id || null,
      null,
      null,
      `Cancelled background job: ${jobId}`,
      'warning',
      { queue: job.queueName }
    );

    res.json({
      success: true,
      message: 'Job cancelled successfully'
    });

  } catch (error: any) {
    logger.error('Failed to cancel job:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to cancel job'
    });
  }
};

export default {
  getJobStatus,
  listJobs,
  cancelJob
};
