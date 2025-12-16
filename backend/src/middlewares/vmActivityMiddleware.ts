import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient();

/**
 * VM Activity Tracking Middleware
 * Automatically updates last_activity_at timestamp for VMs
 */

/**
 * Track VM activity from API requests
 */
export const trackVMActivity = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const vmId = parseInt(req.params.id || req.params.vmId);

    if (!vmId || isNaN(vmId)) {
      next();
      return;
    }

    // Update last_activity_at asynchronously (don't block the request)
    prisma.virtual_machines.update({
      where: { id: vmId },
      data: { last_activity_at: new Date() }
    }).catch(err => {
      logger.error(`Failed to update VM activity for VM ${vmId}:`, err);
    });

    next();
  } catch (error) {
    logger.error('VM activity tracking error:', error);
    next();
  }
};

/**
 * Track console access activity
 */
export const trackConsoleActivity = async (vmId: number): Promise<void> => {
  try {
    await prisma.virtual_machines.update({
      where: { id: vmId },
      data: { last_activity_at: new Date() }
    });

    logger.info(`Console activity tracked for VM ${vmId}`);
  } catch (error) {
    logger.error(`Failed to track console activity for VM ${vmId}:`, error);
  }
};

/**
 * Track VM activity by VMID and cluster
 */
export const trackVMActivityByVMID = async (vmid: number, clusterId: number): Promise<void> => {
  try {
    await prisma.virtual_machines.updateMany({
      where: {
        vmid: vmid,
        cluster_id: clusterId
      },
      data: { last_activity_at: new Date() }
    });
  } catch (error) {
    logger.error(`Failed to track VM activity for VMID ${vmid} on cluster ${clusterId}:`, error);
  }
};

/**
 * Track power state change activity
 */
export const trackPowerStateActivity = async (vmId: number, action: string): Promise<void> => {
  try {
    await prisma.virtual_machines.update({
      where: { id: vmId },
      data: {
        last_activity_at: new Date(),
        status: action === 'start' ? 'running' : action === 'stop' ? 'stopped' : undefined
      }
    });

    logger.info(`Power state activity tracked for VM ${vmId}: ${action}`);
  } catch (error) {
    logger.error(`Failed to track power state activity for VM ${vmId}:`, error);
  }
};

export default {
  trackVMActivity,
  trackConsoleActivity,
  trackVMActivityByVMID,
  trackPowerStateActivity
};
