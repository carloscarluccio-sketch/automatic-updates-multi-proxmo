import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth';
import logger from '../utils/logger';

const prisma = new PrismaClient();

export const getIPRanges = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { company_id: queryCompanyId, cluster_id, ip_type } = req.query;

    let where: any = {};

    // Apply company filtering based on role
    if (role !== 'super_admin') {
      // Non-super_admin can only see their company's IP ranges
      if (company_id === null) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }
      where.company_id = company_id;
    } else if (queryCompanyId) {
      // Super_admin can filter by company_id if provided
      where.company_id = Number(queryCompanyId);
    }

    // Apply additional filters
    if (cluster_id) {
      where.cluster_id = Number(cluster_id);
    }

    if (ip_type) {
      where.ip_type = ip_type as string;
    }

    const ipRanges = await prisma.ip_ranges.findMany({
      where,
      include: {
        companies: {
          select: {
            id: true,
            name: true,
          },
        },
        proxmox_clusters: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
        _count: {
          select: {
            vm_ip_assignments: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    res.json({ success: true, data: ipRanges });
  } catch (error) {
    logger.error('Get IP ranges error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch IP ranges' });
  }
};

export const getIPRange = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    let where: any = { id: Number(id) };

    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
    }

    const ipRange = await prisma.ip_ranges.findFirst({
      where,
      include: {
        companies: {
          select: {
            id: true,
            name: true,
          },
        },
        proxmox_clusters: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
        vm_ip_assignments: {
          include: {
            virtual_machines: {
              select: {
                id: true,
                name: true,
                vmid: true,
              },
            },
          },
        },
        _count: {
          select: {
            vm_ip_assignments: true,
          },
        },
      },
    });

    if (!ipRange) {
      res.status(404).json({ success: false, message: 'IP range not found' });
      return;
    }

    res.json({ success: true, data: ipRange });
  } catch (error) {
    logger.error('Get IP range error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch IP range' });
  }
};

export const createIPRange = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const {
      description,
      subnet,
      gateway,
      netmask,
      vlan_id,
      sdn_zone,
      sdn_vnet,
      ip_type,
      is_shared,
      company_id: requestCompanyId,
      cluster_id,
    } = req.body;

    // Validate required fields
    if (!subnet || !cluster_id) {
      res.status(400).json({ success: false, message: 'Subnet and cluster ID are required' });
      return;
    }

    // Determine company_id based on role
    let finalCompanyId: number | null = null;
    if (role === 'super_admin') {
      if (requestCompanyId) {
        finalCompanyId = Number(requestCompanyId);
      } else if (!is_shared) {
        res.status(400).json({ success: false, message: 'Company ID is required for non-shared ranges' });
        return;
      }
    } else {
      if (company_id === null) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }
      finalCompanyId = company_id;
    }

    // Check if cluster exists
    const cluster = await prisma.proxmox_clusters.findUnique({
      where: { id: Number(cluster_id) },
    });

    if (!cluster) {
      res.status(404).json({ success: false, message: 'Cluster not found' });
      return;
    }

    // Check if company exists (if finalCompanyId is set)
    if (finalCompanyId) {
      const company = await prisma.companies.findUnique({
        where: { id: finalCompanyId },
      });

      if (!company) {
        res.status(404).json({ success: false, message: 'Company not found' });
        return;
      }
    }

    // Check for duplicate subnet within the same cluster
    const existingRange = await prisma.ip_ranges.findFirst({
      where: {
        cluster_id: Number(cluster_id),
        subnet,
      },
    });

    if (existingRange) {
      res.status(400).json({ success: false, message: 'IP range with this subnet already exists for this cluster' });
      return;
    }

    const ipRange = await prisma.ip_ranges.create({
      data: {
        subnet,
        description,
        gateway,
        netmask,
        vlan_id: vlan_id ? Number(vlan_id) : null,
        sdn_zone,
        sdn_vnet,
        ip_type: ip_type || 'internal',
        is_shared: is_shared || false,
        company_id: finalCompanyId,
        cluster_id: Number(cluster_id),
      },
      include: {
        companies: {
          select: {
            id: true,
            name: true,
          },
        },
        proxmox_clusters: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
      },
    });

    res.status(201).json({ success: true, data: ipRange });
  } catch (error) {
    logger.error('Create IP range error:', error);
    res.status(500).json({ success: false, message: 'Failed to create IP range' });
  }
};

export const updateIPRange = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;
    const {
      description,
      subnet,
      gateway,
      netmask,
      vlan_id,
      sdn_zone,
      sdn_vnet,
      ip_type,
      is_shared,
    } = req.body;

    // Check permission
    let where: any = { id: Number(id) };
    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
    }

    const existingRange = await prisma.ip_ranges.findFirst({ where });
    if (!existingRange) {
      res.status(404).json({ success: false, message: 'IP range not found' });
      return;
    }

    // Check for duplicate subnet if it's being changed
    if (subnet && subnet !== existingRange.subnet) {
      const duplicateRange = await prisma.ip_ranges.findFirst({
        where: {
          cluster_id: existingRange.cluster_id,
          subnet,
          id: { not: Number(id) },
        },
      });

      if (duplicateRange) {
        res.status(400).json({ success: false, message: 'IP range with this subnet already exists for this cluster' });
        return;
      }
    }

    // Build update data
    const updateData: any = {};
    if (description !== undefined) updateData.description = description;
    if (subnet !== undefined) updateData.subnet = subnet;
    if (gateway !== undefined) updateData.gateway = gateway;
    if (netmask !== undefined) updateData.netmask = netmask;
    if (vlan_id !== undefined) updateData.vlan_id = vlan_id ? Number(vlan_id) : null;
    if (sdn_zone !== undefined) updateData.sdn_zone = sdn_zone;
    if (sdn_vnet !== undefined) updateData.sdn_vnet = sdn_vnet;
    if (ip_type !== undefined) updateData.ip_type = ip_type;
    if (is_shared !== undefined && role === 'super_admin') updateData.is_shared = is_shared;

    const ipRange = await prisma.ip_ranges.update({
      where: { id: Number(id) },
      data: updateData,
      include: {
        companies: {
          select: {
            id: true,
            name: true,
          },
        },
        proxmox_clusters: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
        _count: {
          select: {
            vm_ip_assignments: true,
          },
        },
      },
    });

    res.json({ success: true, data: ipRange });
  } catch (error) {
    logger.error('Update IP range error:', error);
    res.status(500).json({ success: false, message: 'Failed to update IP range' });
  }
};

export const deleteIPRange = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    // Check permission
    let where: any = { id: Number(id) };
    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
    }

    const ipRange = await prisma.ip_ranges.findFirst({ where });
    if (!ipRange) {
      res.status(404).json({ success: false, message: 'IP range not found' });
      return;
    }

    // Check if IP range has assigned IPs
    const assignedCount = await prisma.vm_ip_assignments.count({
      where: { ip_range_id: Number(id) },
    });

    if (assignedCount > 0) {
      res.status(400).json({
        success: false,
        message: `Cannot delete IP range with ${assignedCount} assigned IPs. Please remove IP assignments first.`
      });
      return;
    }

    await prisma.ip_ranges.delete({
      where: { id: Number(id) },
    });

    res.json({ success: true, message: 'IP range deleted successfully' });
  } catch (error) {
    logger.error('Delete IP range error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete IP range' });
  }
};

export const getAvailableIPs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    // Check permission
    let where: any = { id: Number(id) };
    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
    }

    const ipRange = await prisma.ip_ranges.findFirst({
      where,
      include: {
        vm_ip_assignments: {
          select: {
            ip_address: true,
          },
        },
      },
    });

    if (!ipRange) {
      res.status(404).json({ success: false, message: 'IP range not found' });
      return;
    }

    // Calculate available IPs from CIDR
    // This is a simplified version - in production, use a proper IP calculation library
    const assignedIPs = ipRange.vm_ip_assignments.map(a => a.ip_address);

    // Return basic info for now
    res.json({
      success: true,
      data: {
        subnet: ipRange.subnet,
        gateway: ipRange.gateway,
        assigned_count: assignedIPs.length,
        assigned_ips: assignedIPs,
      },
    });
  } catch (error) {
    logger.error('Get available IPs error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch available IPs' });
  }
};
