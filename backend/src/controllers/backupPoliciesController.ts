import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: {
    id: number;
    role: string;
    company_id?: number;
  };
}

// Get all backup policies with company filtering
export const getBackupPolicies = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    let policies;

    if (role === 'super_admin') {
      policies = await prisma.backup_policies.findMany({
        include: {
          companies: {
            select: { id: true, name: true }
          },
          proxmox_clusters: {
            select: { id: true, name: true, host: true }
          },
          vm_backup_assignments: {
            select: { id: true, vm_id: true }
          }
        },
        orderBy: { created_at: 'desc' }
      });
    } else {
      // Company users only see their own backup policies
      policies = await prisma.backup_policies.findMany({
        where: { company_id: company_id! },
        include: {
          companies: {
            select: { id: true, name: true }
          },
          proxmox_clusters: {
            select: { id: true, name: true, host: true }
          },
          vm_backup_assignments: {
            select: { id: true, vm_id: true }
          }
        },
        orderBy: { created_at: 'desc' }
      });
    }

    res.json({ success: true, data: policies });
  } catch (error) {
    logger.error('Get backup policies error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch backup policies' });
  }
};

// Get single backup policy by ID
export const getBackupPolicy = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { id } = req.params;

    const policy = await prisma.backup_policies.findUnique({
      where: { id: parseInt(id) },
      include: {
        companies: {
          select: { id: true, name: true }
        },
        proxmox_clusters: {
          select: { id: true, name: true, host: true }
        },
        vm_backup_assignments: {
          include: {
            virtual_machines: {
              select: { id: true, name: true, vmid: true }
            }
          }
        }
      }
    });

    if (!policy) {
      res.status(404).json({ success: false, message: 'Backup policy not found' });
      return;
    }

    // Permission check - company users can only access their own policies
    if (role !== 'super_admin' && policy.company_id !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    res.json({ success: true, data: policy });
  } catch (error) {
    logger.error('Get backup policy error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch backup policy' });
  }
};

// Create new backup policy
export const createBackupPolicy = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const {
      target_company_id,
      cluster_id,
      name,
      schedule_cron,
      retention_days,
      compression,
      mode,
      storage_location,
      enabled
    } = req.body;

    // Validation
    if (!cluster_id || !name) {
      res.status(400).json({ success: false, message: 'Cluster ID and name are required' });
      return;
    }

    // Verify cluster exists
    const cluster = await prisma.proxmox_clusters.findUnique({
      where: { id: cluster_id }
    });

    if (!cluster) {
      res.status(404).json({ success: false, message: 'Cluster not found' });
      return;
    }

    // Determine company_id based on role
    let finalCompanyId: number;

    if (role === 'super_admin') {
      if (!target_company_id) {
        res.status(400).json({ success: false, message: 'Company ID is required for super admin' });
        return;
      }
      finalCompanyId = target_company_id;
    } else {
      finalCompanyId = company_id!;
    }

    // Verify company exists
    const company = await prisma.companies.findUnique({
      where: { id: finalCompanyId }
    });

    if (!company) {
      res.status(404).json({ success: false, message: 'Company not found' });
      return;
    }

    const policyData: any = {
      company_id: finalCompanyId,
      cluster_id,
      name,
      schedule_cron: schedule_cron || '0 2 * * *', // Default: 2 AM daily
      retention_days: retention_days !== undefined ? retention_days : 7,
      compression: compression || 'zstd',
      mode: mode || 'snapshot',
      storage_location: storage_location || null,
      enabled: enabled !== undefined ? enabled : true
    };

    const policy = await prisma.backup_policies.create({
      data: policyData,
      include: {
        companies: {
          select: { id: true, name: true }
        },
        proxmox_clusters: {
          select: { id: true, name: true, host: true }
        },
        vm_backup_assignments: true
      }
    });

    logger.info(`Backup policy created: ${policy.name} (ID: ${policy.id})`);
    res.status(201).json({ success: true, data: policy });
  } catch (error: any) {
    logger.error('Create backup policy error:', error);
    if (error.code === 'P2002') {
      res.status(400).json({ success: false, message: 'A backup policy with this name already exists' });
      return;
    }
    res.status(500).json({ success: false, message: 'Failed to create backup policy' });
  }
};

// Update backup policy
export const updateBackupPolicy = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { id } = req.params;
    const {
      name,
      schedule_cron,
      retention_days,
      compression,
      mode,
      storage_location,
      enabled
    } = req.body;

    const existingPolicy = await prisma.backup_policies.findUnique({
      where: { id: parseInt(id) },
      select: { id: true, company_id: true, name: true }
    });

    if (!existingPolicy) {
      res.status(404).json({ success: false, message: 'Backup policy not found' });
      return;
    }

    // Permission check
    if (role !== 'super_admin' && existingPolicy.company_id !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied - Policy belongs to another company' });
      return;
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (schedule_cron !== undefined) updateData.schedule_cron = schedule_cron;
    if (retention_days !== undefined) updateData.retention_days = retention_days;
    if (compression !== undefined) updateData.compression = compression;
    if (mode !== undefined) updateData.mode = mode;
    if (storage_location !== undefined) updateData.storage_location = storage_location;
    if (enabled !== undefined) updateData.enabled = enabled;

    const updatedPolicy = await prisma.backup_policies.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        companies: {
          select: { id: true, name: true }
        },
        proxmox_clusters: {
          select: { id: true, name: true, host: true }
        },
        vm_backup_assignments: true
      }
    });

    logger.info(`Backup policy updated: ${updatedPolicy.name} (ID: ${updatedPolicy.id})`);
    res.json({ success: true, data: updatedPolicy });
  } catch (error: any) {
    logger.error('Update backup policy error:', error);
    if (error.code === 'P2002') {
      res.status(400).json({ success: false, message: 'A backup policy with this name already exists' });
      return;
    }
    res.status(500).json({ success: false, message: 'Failed to update backup policy' });
  }
};

// Delete backup policy
export const deleteBackupPolicy = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { id } = req.params;

    const existingPolicy = await prisma.backup_policies.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        company_id: true,
        name: true,
        vm_backup_assignments: {
          select: { id: true }
        }
      }
    });

    if (!existingPolicy) {
      res.status(404).json({ success: false, message: 'Backup policy not found' });
      return;
    }

    // Permission check
    if (role !== 'super_admin' && existingPolicy.company_id !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied - Policy belongs to another company' });
      return;
    }

    // Check if policy is in use by VM assignments
    if (existingPolicy.vm_backup_assignments.length > 0) {
      res.status(400).json({
        success: false,
        message: `Cannot delete backup policy - it is assigned to ${existingPolicy.vm_backup_assignments.length} VM(s)`
      });
      return;
    }

    await prisma.backup_policies.delete({
      where: { id: parseInt(id) }
    });

    logger.info(`Backup policy deleted: ${existingPolicy.name} (ID: ${existingPolicy.id})`);
    res.json({ success: true, message: 'Backup policy deleted successfully' });
  } catch (error) {
    logger.error('Delete backup policy error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete backup policy' });
  }
};

// Toggle enabled status
export const toggleEnabled = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { id } = req.params;

    const existingPolicy = await prisma.backup_policies.findUnique({
      where: { id: parseInt(id) },
      select: { id: true, company_id: true, enabled: true }
    });

    if (!existingPolicy) {
      res.status(404).json({ success: false, message: 'Backup policy not found' });
      return;
    }

    // Permission check
    if (role !== 'super_admin' && existingPolicy.company_id !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const updatedPolicy = await prisma.backup_policies.update({
      where: { id: parseInt(id) },
      data: { enabled: !existingPolicy.enabled },
      include: {
        companies: {
          select: { id: true, name: true }
        },
        proxmox_clusters: {
          select: { id: true, name: true, host: true }
        }
      }
    });

    res.json({ success: true, data: updatedPolicy });
  } catch (error) {
    logger.error('Toggle backup policy error:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle backup policy' });
  }
};

// Get available clusters for dropdown
export const getAvailableClusters = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    let clusters;

    if (role === 'super_admin') {
      clusters = await prisma.proxmox_clusters.findMany({
        select: {
          id: true,
          name: true,
          host: true,
          location: true
        },
        orderBy: { name: 'asc' }
      });
    } else {
      // Get clusters assigned to the user's company
      clusters = await prisma.proxmox_clusters.findMany({
        where: {
          company_clusters: {
            some: { company_id: company_id! }
          }
        },
        select: {
          id: true,
          name: true,
          host: true,
          location: true
        },
        orderBy: { name: 'asc' }
      });
    }

    res.json({ success: true, data: clusters });
  } catch (error) {
    logger.error('Get available clusters error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch clusters' });
  }
};
