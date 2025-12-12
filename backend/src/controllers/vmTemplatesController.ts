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

// Get all VM templates with company filtering
export const getVMTemplates = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { os_type, is_public } = req.query;

    let where: any = {};

    // Apply filters
    if (os_type) {
      where.os_type = os_type;
    }

    if (role !== 'super_admin') {
      // Company users see their own templates + public templates
      where.OR = [
        { company_id: company_id },
        { is_public: true }
      ];
    } else if (is_public !== undefined) {
      where.is_public = is_public === 'true';
    }

    const templates = await prisma.vm_templates.findMany({
      where,
      include: {
        companies: {
          select: { id: true, name: true }
        },
        proxmox_clusters: {
          select: { id: true, name: true, host: true }
        },
        users: {
          select: { id: true, username: true, email: true }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    res.json({ success: true, data: templates });
  } catch (error) {
    logger.error('Get VM templates error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch VM templates' });
  }
};

// Get single VM template by ID
export const getVMTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { id } = req.params;

    const template = await prisma.vm_templates.findUnique({
      where: { id: parseInt(id) },
      include: {
        companies: {
          select: { id: true, name: true }
        },
        proxmox_clusters: {
          select: { id: true, name: true, host: true }
        },
        users: {
          select: { id: true, username: true, email: true }
        }
      }
    });

    if (!template) {
      res.status(404).json({ success: false, message: 'VM template not found' });
      return;
    }

    // Permission check - company users can only access their own templates or public ones
    if (role !== 'super_admin') {
      if (template.company_id !== company_id && !template.is_public) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }
    }

    res.json({ success: true, data: template });
  } catch (error) {
    logger.error('Get VM template error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch VM template' });
  }
};

// Create new VM template
export const createVMTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id, id: user_id } = req.user!;
    const {
      target_company_id,
      name,
      description,
      vmid,
      node_name,
      cluster_id,
      os_type,
      os_version,
      cpu_cores,
      memory_mb,
      disk_size_gb,
      has_cloud_init,
      cloud_init_user,
      cloud_init_packages,
      cloud_init_script,
      network_bridge,
      network_model,
      is_public
    } = req.body;

    // Validation
    if (!name || !vmid || !node_name || !cluster_id) {
      res.status(400).json({ success: false, message: 'Name, VMID, node, and cluster are required' });
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
    let finalCompanyId: number | null = null;

    if (role === 'super_admin') {
      finalCompanyId = target_company_id || null;
    } else {
      finalCompanyId = company_id!;
    }

    // Verify company exists if specified
    if (finalCompanyId) {
      const company = await prisma.companies.findUnique({
        where: { id: finalCompanyId }
      });

      if (!company) {
        res.status(404).json({ success: false, message: 'Company not found' });
        return;
      }
    }

    const templateData: any = {
      name,
      description: description || null,
      vmid,
      node_name,
      cluster_id,
      company_id: finalCompanyId,
      os_type: os_type || 'linux',
      os_version: os_version || null,
      cpu_cores: cpu_cores || 2,
      memory_mb: memory_mb || 2048,
      disk_size_gb: disk_size_gb || 20,
      has_cloud_init: has_cloud_init || false,
      cloud_init_user: cloud_init_user || null,
      cloud_init_packages: cloud_init_packages || null,
      cloud_init_script: cloud_init_script || null,
      network_bridge: network_bridge || 'vmbr0',
      network_model: network_model || 'virtio',
      is_public: role === 'super_admin' ? (is_public || false) : false,
      created_by: user_id
    };

    const template = await prisma.vm_templates.create({
      data: templateData,
      include: {
        companies: {
          select: { id: true, name: true }
        },
        proxmox_clusters: {
          select: { id: true, name: true, host: true }
        },
        users: {
          select: { id: true, username: true, email: true }
        }
      }
    });

    logger.info(`VM template created: ${template.name} (ID: ${template.id})`);
    res.status(201).json({ success: true, data: template });
  } catch (error: any) {
    logger.error('Create VM template error:', error);
    if (error.code === 'P2002') {
      res.status(400).json({ success: false, message: 'A template with this VMID already exists on this cluster' });
      return;
    }
    res.status(500).json({ success: false, message: 'Failed to create VM template' });
  }
};

// Update VM template
export const updateVMTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { id } = req.params;
    const {
      name,
      description,
      os_type,
      os_version,
      cpu_cores,
      memory_mb,
      disk_size_gb,
      has_cloud_init,
      cloud_init_user,
      cloud_init_packages,
      cloud_init_script,
      network_bridge,
      network_model,
      is_public
    } = req.body;

    const existingTemplate = await prisma.vm_templates.findUnique({
      where: { id: parseInt(id) },
      select: { id: true, company_id: true, name: true, is_public: true }
    });

    if (!existingTemplate) {
      res.status(404).json({ success: false, message: 'VM template not found' });
      return;
    }

    // Permission check
    if (role !== 'super_admin') {
      if (existingTemplate.company_id !== company_id) {
        res.status(403).json({ success: false, message: 'Access denied - Template belongs to another company' });
        return;
      }
      // Only super_admin can modify public templates
      if (existingTemplate.is_public) {
        res.status(403).json({ success: false, message: 'Only super admin can modify public templates' });
        return;
      }
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (os_type !== undefined) updateData.os_type = os_type;
    if (os_version !== undefined) updateData.os_version = os_version;
    if (cpu_cores !== undefined) updateData.cpu_cores = cpu_cores;
    if (memory_mb !== undefined) updateData.memory_mb = memory_mb;
    if (disk_size_gb !== undefined) updateData.disk_size_gb = disk_size_gb;
    if (has_cloud_init !== undefined) updateData.has_cloud_init = has_cloud_init;
    if (cloud_init_user !== undefined) updateData.cloud_init_user = cloud_init_user;
    if (cloud_init_packages !== undefined) updateData.cloud_init_packages = cloud_init_packages;
    if (cloud_init_script !== undefined) updateData.cloud_init_script = cloud_init_script;
    if (network_bridge !== undefined) updateData.network_bridge = network_bridge;
    if (network_model !== undefined) updateData.network_model = network_model;

    // Only super_admin can change is_public status
    if (role === 'super_admin' && is_public !== undefined) {
      updateData.is_public = is_public;
    }

    const updatedTemplate = await prisma.vm_templates.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        companies: {
          select: { id: true, name: true }
        },
        proxmox_clusters: {
          select: { id: true, name: true, host: true }
        },
        users: {
          select: { id: true, username: true, email: true }
        }
      }
    });

    logger.info(`VM template updated: ${updatedTemplate.name} (ID: ${updatedTemplate.id})`);
    res.json({ success: true, data: updatedTemplate });
  } catch (error: any) {
    logger.error('Update VM template error:', error);
    if (error.code === 'P2002') {
      res.status(400).json({ success: false, message: 'A template with this name already exists' });
      return;
    }
    res.status(500).json({ success: false, message: 'Failed to update VM template' });
  }
};

// Delete VM template
export const deleteVMTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { id } = req.params;

    const existingTemplate = await prisma.vm_templates.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        company_id: true,
        name: true,
        is_public: true
      }
    });

    if (!existingTemplate) {
      res.status(404).json({ success: false, message: 'VM template not found' });
      return;
    }

    // Permission check
    if (role !== 'super_admin') {
      if (existingTemplate.company_id !== company_id) {
        res.status(403).json({ success: false, message: 'Access denied - Template belongs to another company' });
        return;
      }
      // Only super_admin can delete public templates
      if (existingTemplate.is_public) {
        res.status(403).json({ success: false, message: 'Only super admin can delete public templates' });
        return;
      }
    }

    await prisma.vm_templates.delete({
      where: { id: parseInt(id) }
    });

    logger.info(`VM template deleted: ${existingTemplate.name} (ID: ${existingTemplate.id})`);
    res.json({ success: true, message: 'VM template deleted successfully' });
  } catch (error) {
    logger.error('Delete VM template error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete VM template' });
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
