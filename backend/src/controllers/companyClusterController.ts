import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../config/database';
import logger from '../utils/logger';

/**
 * Get all cluster assignments for a company
 */
export const getCompanyClusters = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { companyId } = req.params;

    // Access control
    if (role !== 'super_admin' && Number(companyId) !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const assignments = await prisma.company_clusters.findMany({
      where: { company_id: Number(companyId) },
      include: {
        proxmox_clusters: {
          select: {
            id: true,
            name: true,
            host: true,
            port: true,
            location: true,
            status: true
          }
        }
      },
      orderBy: { assigned_at: 'desc' }
    });

    res.json({
      success: true,
      data: assignments
    });
  } catch (error: any) {
    logger.error('Get company clusters error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch company clusters',
      error: error.message
    });
  }
};

/**
 * Get all available clusters (not yet assigned to company)
 */
export const getAvailableClusters = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role } = req.user!;
    const { companyId } = req.params;

    // Only super_admin can manage cluster assignments
    if (role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    // Get already assigned cluster IDs
    const assigned = await prisma.company_clusters.findMany({
      where: { company_id: Number(companyId) },
      select: { cluster_id: true }
    });

    const assignedIds = assigned.map(a => a.cluster_id);

    // Get all clusters not yet assigned
    const availableClusters = await prisma.proxmox_clusters.findMany({
      where: {
        id: {
          notIn: assignedIds.length > 0 ? assignedIds : undefined
        },
        status: 'active'
      },
      select: {
        id: true,
        name: true,
        host: true,
        port: true,
        location: true,
        status: true
      },
      orderBy: { name: 'asc' }
    });

    res.json({
      success: true,
      data: availableClusters
    });
  } catch (error: any) {
    logger.error('Get available clusters error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available clusters',
      error: error.message
    });
  }
};

/**
 * Assign a cluster to a company
 */
export const assignCluster = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role } = req.user!;
    const { companyId } = req.params;
    const { cluster_id } = req.body;

    // Only super_admin can assign clusters
    if (role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    if (!cluster_id) {
      res.status(400).json({ success: false, message: 'cluster_id is required' });
      return;
    }

    // Check if company exists
    const company = await prisma.companies.findUnique({
      where: { id: Number(companyId) }
    });

    if (!company) {
      res.status(404).json({ success: false, message: 'Company not found' });
      return;
    }

    // Check if cluster exists
    const cluster = await prisma.proxmox_clusters.findUnique({
      where: { id: Number(cluster_id) }
    });

    if (!cluster) {
      res.status(404).json({ success: false, message: 'Cluster not found' });
      return;
    }

    // Check if already assigned
    const existing = await prisma.company_clusters.findFirst({
      where: {
        company_id: Number(companyId),
        cluster_id: Number(cluster_id)
      }
    });

    if (existing) {
      res.status(400).json({ success: false, message: 'Cluster already assigned to this company' });
      return;
    }

    // Create assignment
    const assignment = await prisma.company_clusters.create({
      data: {
        company_id: Number(companyId),
        cluster_id: Number(cluster_id)
      },
      include: {
        proxmox_clusters: {
          select: {
            id: true,
            name: true,
            host: true,
            location: true
          }
        }
      }
    });

    logger.info(`Cluster ${cluster.name} assigned to company ${company.name}`);

    res.status(201).json({
      success: true,
      message: 'Cluster assigned successfully',
      data: assignment
    });
  } catch (error: any) {
    logger.error('Assign cluster error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign cluster',
      error: error.message
    });
  }
};

/**
 * Unassign a cluster from a company
 */
export const unassignCluster = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role } = req.user!;
    const { companyId, clusterId } = req.params;

    // Only super_admin can unassign clusters
    if (role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    // Check if assignment exists
    const assignment = await prisma.company_clusters.findFirst({
      where: {
        company_id: Number(companyId),
        cluster_id: Number(clusterId)
      }
    });

    if (!assignment) {
      res.status(404).json({ success: false, message: 'Cluster assignment not found' });
      return;
    }

    // Check if there are VMs on this cluster for this company
    const vmsOnCluster = await prisma.virtual_machines.count({
      where: {
        company_id: Number(companyId),
        cluster_id: Number(clusterId),
        status: { notIn: ['deleted'] }
      }
    });

    if (vmsOnCluster > 0) {
      res.status(400).json({
        success: false,
        message: `Cannot unassign cluster. There are ${vmsOnCluster} active VMs on this cluster. Please migrate or delete them first.`
      });
      return;
    }

    // Delete assignment
    await prisma.company_clusters.delete({
      where: { id: assignment.id }
    });

    logger.info(`Cluster ${clusterId} unassigned from company ${companyId}`);

    res.json({
      success: true,
      message: 'Cluster unassigned successfully'
    });
  } catch (error: any) {
    logger.error('Unassign cluster error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unassign cluster',
      error: error.message
    });
  }
};

/**
 * Bulk assign multiple clusters to a company
 */
export const bulkAssignClusters = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role } = req.user!;
    const { companyId } = req.params;
    const { cluster_ids } = req.body;

    // Only super_admin can assign clusters
    if (role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    if (!Array.isArray(cluster_ids) || cluster_ids.length === 0) {
      res.status(400).json({ success: false, message: 'cluster_ids array is required' });
      return;
    }

    // Check if company exists
    const company = await prisma.companies.findUnique({
      where: { id: Number(companyId) }
    });

    if (!company) {
      res.status(404).json({ success: false, message: 'Company not found' });
      return;
    }

    // Get existing assignments
    const existingAssignments = await prisma.company_clusters.findMany({
      where: {
        company_id: Number(companyId),
        cluster_id: { in: cluster_ids.map(id => Number(id)) }
      },
      select: { cluster_id: true }
    });

    const existingClusterIds = existingAssignments.map(a => a.cluster_id);
    const newClusterIds = cluster_ids.filter(id => !existingClusterIds.includes(Number(id)));

    if (newClusterIds.length === 0) {
      res.status(400).json({ success: false, message: 'All clusters are already assigned' });
      return;
    }

    // Create assignments in bulk
    const assignments = await prisma.company_clusters.createMany({
      data: newClusterIds.map(cluster_id => ({
        company_id: Number(companyId),
        cluster_id: Number(cluster_id)
      })),
      skipDuplicates: true
    });

    logger.info(`${assignments.count} clusters assigned to company ${company.name}`);

    res.status(201).json({
      success: true,
      message: `${assignments.count} clusters assigned successfully`,
      data: { assigned_count: assignments.count, skipped_count: existingClusterIds.length }
    });
  } catch (error: any) {
    logger.error('Bulk assign clusters error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk assign clusters',
      error: error.message
    });
  }
};

/**
 * Get cluster quotas for a company
 */
export const getCompanyClusterQuotas = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { companyId } = req.params;

    // Access control
    if (role !== 'super_admin' && Number(companyId) !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const quotas = await prisma.company_quotas.findMany({
      where: {
        company_id: Number(companyId),
        cluster_id: { not: null }
      },
      include: {
        proxmox_clusters: {
          select: {
            id: true,
            name: true,
            location: true
          }
        }
      },
      orderBy: [
        { cluster_id: 'asc' },
        { quota_type: 'asc' }
      ]
    });

    res.json({
      success: true,
      data: quotas
    });
  } catch (error: any) {
    logger.error('Get company cluster quotas error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cluster quotas',
      error: error.message
    });
  }
};
