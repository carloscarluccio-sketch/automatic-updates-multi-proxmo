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

// Get all DR cluster pairs
export const getDRClusterPairs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    let clusterPairs;

    if (role === 'super_admin') {
      clusterPairs = await prisma.dr_cluster_pairs.findMany({
        include: {
          proxmox_clusters_dr_cluster_pairs_primary_cluster_idToproxmox_clusters: {
            select: { id: true, name: true, host: true }
          },
          proxmox_clusters_dr_cluster_pairs_dr_cluster_idToproxmox_clusters: {
            select: { id: true, name: true, host: true }
          },
          companies: {
            select: { id: true, name: true }
          },
          users: {
            select: { id: true, username: true }
          }
        },
        orderBy: { created_at: 'desc' }
      });
    } else {
      // Company users only see their own cluster pairs
      clusterPairs = await prisma.dr_cluster_pairs.findMany({
        where: { company_id: company_id! },
        include: {
          proxmox_clusters_dr_cluster_pairs_primary_cluster_idToproxmox_clusters: {
            select: { id: true, name: true, host: true }
          },
          proxmox_clusters_dr_cluster_pairs_dr_cluster_idToproxmox_clusters: {
            select: { id: true, name: true, host: true }
          },
          companies: {
            select: { id: true, name: true }
          },
          users: {
            select: { id: true, username: true }
          }
        },
        orderBy: { created_at: 'desc' }
      });
    }

    res.json({ success: true, data: clusterPairs });
  } catch (error) {
    logger.error('Get DR cluster pairs error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch DR cluster pairs' });
  }
};

// Get single DR cluster pair by ID
export const getDRClusterPair = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { id } = req.params;

    const clusterPair = await prisma.dr_cluster_pairs.findUnique({
      where: { id: parseInt(id) },
      include: {
        proxmox_clusters_dr_cluster_pairs_primary_cluster_idToproxmox_clusters: {
          select: { id: true, name: true, host: true }
        },
        proxmox_clusters_dr_cluster_pairs_dr_cluster_idToproxmox_clusters: {
          select: { id: true, name: true, host: true }
        },
        companies: {
          select: { id: true, name: true }
        },
        users: {
          select: { id: true, username: true }
        }
      }
    });

    if (!clusterPair) {
      res.status(404).json({ success: false, message: 'DR cluster pair not found' });
      return;
    }

    // Check permissions
    if (role !== 'super_admin' && clusterPair.company_id !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    res.json({ success: true, data: clusterPair });
  } catch (error) {
    logger.error('Get DR cluster pair error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch DR cluster pair' });
  }
};

// Create new DR cluster pair
export const createDRClusterPair = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id, id: user_id } = req.user!;
    const {
      primary_cluster_id,
      dr_cluster_id,
      pair_name,
      replication_enabled,
      replication_schedule,
      replication_method,
      dr_network_mapping,
      dr_ip_translation,
      auto_failover_enabled,
      failover_priority,
      max_failover_time,
      require_manual_approval,
      health_check_enabled,
      health_check_interval,
      failure_threshold,
      status,
      company_id: target_company_id
    } = req.body;

    // Validate required fields
    if (!primary_cluster_id || !dr_cluster_id) {
      res.status(400).json({ success: false, message: 'Primary and DR cluster IDs are required' });
      return;
    }

    // Prevent creating pair with same cluster as primary and DR
    if (primary_cluster_id === dr_cluster_id) {
      res.status(400).json({ success: false, message: 'Primary and DR clusters must be different' });
      return;
    }

    // Verify both clusters exist
    const primaryCluster = await prisma.proxmox_clusters.findUnique({
      where: { id: primary_cluster_id }
    });

    const drCluster = await prisma.proxmox_clusters.findUnique({
      where: { id: dr_cluster_id }
    });

    if (!primaryCluster || !drCluster) {
      res.status(404).json({ success: false, message: 'One or both clusters not found' });
      return;
    }

    // Determine company_id and managed_by based on role
    let finalCompanyId: number | null = null;
    let managedBy: 'super_admin' | 'company_admin' = 'super_admin';

    if (role === 'super_admin') {
      // Super admin can assign to any company or leave null
      finalCompanyId = target_company_id || null;
      managedBy = 'super_admin';
    } else {
      // Company admin can only create for their own company
      finalCompanyId = company_id!;
      managedBy = 'company_admin';
    }

    const pairData: any = {
      primary_cluster_id,
      dr_cluster_id,
      pair_name: pair_name || `${primaryCluster.name} → ${drCluster.name}`,
      replication_enabled: replication_enabled !== undefined ? replication_enabled : true,
      replication_schedule: replication_schedule || '*/15 * * * *',
      replication_method: replication_method || 'storage_replication',
      dr_network_mapping: dr_network_mapping || null,
      dr_ip_translation: dr_ip_translation !== undefined ? dr_ip_translation : true,
      auto_failover_enabled: auto_failover_enabled !== undefined ? auto_failover_enabled : false,
      failover_priority: failover_priority || 100,
      max_failover_time: max_failover_time || 300,
      require_manual_approval: require_manual_approval !== undefined ? require_manual_approval : true,
      health_check_enabled: health_check_enabled !== undefined ? health_check_enabled : true,
      health_check_interval: health_check_interval || 60,
      failure_threshold: failure_threshold || 3,
      status: status || 'active',
      company_id: finalCompanyId,
      managed_by: managedBy,
      created_by: user_id
    };

    const clusterPair = await prisma.dr_cluster_pairs.create({
      data: pairData,
      include: {
        proxmox_clusters_dr_cluster_pairs_primary_cluster_idToproxmox_clusters: {
          select: { id: true, name: true, host: true }
        },
        proxmox_clusters_dr_cluster_pairs_dr_cluster_idToproxmox_clusters: {
          select: { id: true, name: true, host: true }
        },
        companies: {
          select: { id: true, name: true }
        },
        users: {
          select: { id: true, username: true }
        }
      }
    });

    res.status(201).json({ success: true, data: clusterPair });
  } catch (error: any) {
    logger.error('Create DR cluster pair error:', error);

    // Handle unique constraint violation
    if (error.code === 'P2002') {
      res.status(400).json({ success: false, message: 'This cluster pair already exists' });
      return;
    }

    res.status(500).json({ success: false, message: 'Failed to create DR cluster pair' });
  }
};

// Update DR cluster pair
export const updateDRClusterPair = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { id } = req.params;
    const {
      pair_name,
      replication_enabled,
      replication_schedule,
      replication_method,
      dr_network_mapping,
      dr_ip_translation,
      auto_failover_enabled,
      failover_priority,
      max_failover_time,
      require_manual_approval,
      health_check_enabled,
      health_check_interval,
      failure_threshold,
      status
    } = req.body;

    // Check if pair exists and user has permission
    const existingPair = await prisma.dr_cluster_pairs.findUnique({
      where: { id: parseInt(id) },
      select: { id: true, company_id: true, managed_by: true }
    });

    if (!existingPair) {
      res.status(404).json({ success: false, message: 'DR cluster pair not found' });
      return;
    }

    // Permission checks
    if (role !== 'super_admin') {
      if (existingPair.company_id !== company_id) {
        res.status(403).json({ success: false, message: 'Access denied - Cluster pair belongs to another company' });
        return;
      }
      if (existingPair.managed_by === 'super_admin') {
        res.status(403).json({ success: false, message: 'Access denied - Only super admin can modify this cluster pair' });
        return;
      }
    }

    const updateData: any = {};
    if (pair_name !== undefined) updateData.pair_name = pair_name;
    if (replication_enabled !== undefined) updateData.replication_enabled = replication_enabled;
    if (replication_schedule !== undefined) updateData.replication_schedule = replication_schedule;
    if (replication_method !== undefined) updateData.replication_method = replication_method;
    if (dr_network_mapping !== undefined) updateData.dr_network_mapping = dr_network_mapping;
    if (dr_ip_translation !== undefined) updateData.dr_ip_translation = dr_ip_translation;
    if (auto_failover_enabled !== undefined) updateData.auto_failover_enabled = auto_failover_enabled;
    if (failover_priority !== undefined) updateData.failover_priority = failover_priority;
    if (max_failover_time !== undefined) updateData.max_failover_time = max_failover_time;
    if (require_manual_approval !== undefined) updateData.require_manual_approval = require_manual_approval;
    if (health_check_enabled !== undefined) updateData.health_check_enabled = health_check_enabled;
    if (health_check_interval !== undefined) updateData.health_check_interval = health_check_interval;
    if (failure_threshold !== undefined) updateData.failure_threshold = failure_threshold;
    if (status !== undefined) updateData.status = status;

    const updatedPair = await prisma.dr_cluster_pairs.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        proxmox_clusters_dr_cluster_pairs_primary_cluster_idToproxmox_clusters: {
          select: { id: true, name: true, host: true }
        },
        proxmox_clusters_dr_cluster_pairs_dr_cluster_idToproxmox_clusters: {
          select: { id: true, name: true, host: true }
        },
        companies: {
          select: { id: true, name: true }
        },
        users: {
          select: { id: true, username: true }
        }
      }
    });

    res.json({ success: true, data: updatedPair });
  } catch (error) {
    logger.error('Update DR cluster pair error:', error);
    res.status(500).json({ success: false, message: 'Failed to update DR cluster pair' });
  }
};

// Delete DR cluster pair
export const deleteDRClusterPair = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { id } = req.params;

    // Check if pair exists and user has permission
    const existingPair = await prisma.dr_cluster_pairs.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        company_id: true,
        managed_by: true,
        dr_test_schedules: { select: { id: true } }
      }
    });

    if (!existingPair) {
      res.status(404).json({ success: false, message: 'DR cluster pair not found' });
      return;
    }

    // Permission checks
    if (role !== 'super_admin') {
      if (existingPair.company_id !== company_id) {
        res.status(403).json({ success: false, message: 'Access denied - Cluster pair belongs to another company' });
        return;
      }
      if (existingPair.managed_by === 'super_admin') {
        res.status(403).json({ success: false, message: 'Access denied - Only super admin can delete this cluster pair' });
        return;
      }
    }

    // Check if pair is in use by DR test schedules
    if (existingPair.dr_test_schedules.length > 0) {
      res.status(400).json({
        success: false,
        message: `Cannot delete cluster pair - it is used by ${existingPair.dr_test_schedules.length} DR test schedule(s)`
      });
      return;
    }

    await prisma.dr_cluster_pairs.delete({
      where: { id: parseInt(id) }
    });

    res.json({ success: true, message: 'DR cluster pair deleted successfully' });
  } catch (error) {
    logger.error('Delete DR cluster pair error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete DR cluster pair' });
  }
};

// Toggle replication status
export const toggleReplication = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { id } = req.params;

    // Check if pair exists and user has permission
    const existingPair = await prisma.dr_cluster_pairs.findUnique({
      where: { id: parseInt(id) },
      select: { id: true, company_id: true, managed_by: true, replication_enabled: true }
    });

    if (!existingPair) {
      res.status(404).json({ success: false, message: 'DR cluster pair not found' });
      return;
    }

    // Permission checks
    if (role !== 'super_admin' && existingPair.company_id !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const updatedPair = await prisma.dr_cluster_pairs.update({
      where: { id: parseInt(id) },
      data: { replication_enabled: !existingPair.replication_enabled },
      include: {
        proxmox_clusters_dr_cluster_pairs_primary_cluster_idToproxmox_clusters: {
          select: { id: true, name: true, host: true }
        },
        proxmox_clusters_dr_cluster_pairs_dr_cluster_idToproxmox_clusters: {
          select: { id: true, name: true, host: true }
        }
      }
    });

    res.json({ success: true, data: updatedPair });
  } catch (error) {
    logger.error('Toggle replication error:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle replication' });
  }
};

// Get available clusters for pairing
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
      // Get clusters assigned to the company
      clusters = await prisma.proxmox_clusters.findMany({
        where: {
          company_clusters: {
            some: {
              company_id: company_id!
            }
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
    res.status(500).json({ success: false, message: 'Failed to fetch available clusters' });
  }
};
