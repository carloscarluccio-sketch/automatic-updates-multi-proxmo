import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../config/database';
import logger from '../utils/logger';
import ProxmoxAPI from '../utils/proxmoxApi';
import { decrypt } from '../utils/encryption';

/**
 * Get all VM templates
 * Super admin sees all templates, company users see their company's templates + public templates
 */
export const getTemplates = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;

    let where: any = {};

    if (role === 'super_admin') {
      // Super admin sees all templates
    } else if (company_id !== null) {
      // Company users see their company's templates and public templates
      where = {
        OR: [
          { company_id },
          { is_public: true }
        ]
      };
    } else {
      // Users without company see only public templates
      where = { is_public: true };
    }

    const templates = await prisma.vm_templates.findMany({
      where,
      include: {
        proxmox_clusters: {
          select: {
            id: true,
            name: true,
            host: true
          }
        },
        companies: {
          select: {
            id: true,
            name: true
          }
        },
        users: {
          select: {
            id: true,
            username: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    res.json({ success: true, data: templates });
  } catch (error) {
    logger.error('Get templates error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch templates' });
  }
};

/**
 * Get single template by ID
 */
export const getTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    let where: any = { id: Number(id) };

    if (role !== 'super_admin' && company_id !== null) {
      where = {
        AND: [
          { id: Number(id) },
          {
            OR: [
              { company_id },
              { is_public: true }
            ]
          }
        ]
      };
    } else if (role !== 'super_admin') {
      where = {
        AND: [
          { id: Number(id) },
          { is_public: true }
        ]
      };
    }

    const template = await prisma.vm_templates.findFirst({
      where,
      include: {
        proxmox_clusters: true,
        companies: true,
        users: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      }
    });

    if (!template) {
      res.status(404).json({ success: false, message: 'Template not found' });
      return;
    }

    res.json({ success: true, data: template });
  } catch (error) {
    logger.error('Get template error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch template' });
  }
};

/**
 * Create new VM template
 */
export const createTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      name,
      description,
      vmid,
      node_name,
      cluster_id,
      company_id: reqCompanyId,
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

    const { role, company_id: userCompanyId, id: userId } = req.user!;

    // Validate required fields
    if (!name || !vmid || !node_name || !cluster_id) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: name, vmid, node_name, cluster_id'
      });
      return;
    }

    // Determine company_id
    let finalCompanyId = null;
    if (role === 'super_admin') {
      finalCompanyId = reqCompanyId || null;
    } else {
      finalCompanyId = userCompanyId;
    }

    // Only super_admin can create public templates
    const finalIsPublic = role === 'super_admin' ? (is_public || false) : false;

    // Check if template with same name exists for this company
    const existing = await prisma.vm_templates.findFirst({
      where: {
        name,
        company_id: finalCompanyId
      }
    });

    if (existing) {
      res.status(400).json({
        success: false,
        message: 'Template with this name already exists for this company'
      });
      return;
    }

    // Verify cluster exists and user has access
    let clusterWhere: any = { id: cluster_id };
    if (role !== 'super_admin' && userCompanyId !== null) {
      clusterWhere.company_id = userCompanyId;
    }

    const cluster = await prisma.proxmox_clusters.findFirst({ where: clusterWhere });
    if (!cluster) {
      res.status(404).json({ success: false, message: 'Cluster not found or access denied' });
      return;
    }

    // Create template
    const template = await prisma.vm_templates.create({
      data: {
        name,
        description,
        vmid,
        node_name,
        cluster_id,
        company_id: finalCompanyId,
        os_type,
        os_version,
        cpu_cores: cpu_cores || 2,
        memory_mb: memory_mb || 2048,
        disk_size_gb: disk_size_gb || 20,
        has_cloud_init: has_cloud_init || false,
        cloud_init_user: cloud_init_user || 'ubuntu',
        cloud_init_packages,
        cloud_init_script,
        network_bridge: network_bridge || 'vmbr0',
        network_model: network_model || 'virtio',
        is_public: finalIsPublic,
        created_by: userId!
      },
      include: {
        proxmox_clusters: true,
        companies: true
      }
    });

    logger.info(`Template created: ${template.id} by user ${userId}`);
    res.status(201).json({ success: true, data: template });
  } catch (error) {
    logger.error('Create template error:', error);
    res.status(500).json({ success: false, message: 'Failed to create template' });
  }
};

/**
 * Update existing template
 */
export const updateTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    // Check if template exists and user has access
    let where: any = { id: Number(id) };
    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
    }

    const existing = await prisma.vm_templates.findFirst({ where });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Template not found or access denied' });
      return;
    }

    // Build update data (only allow updating certain fields)
    const updateData: any = {};
    const allowedFields = [
      'name',
      'description',
      'os_type',
      'os_version',
      'cpu_cores',
      'memory_mb',
      'disk_size_gb',
      'has_cloud_init',
      'cloud_init_user',
      'cloud_init_packages',
      'cloud_init_script',
      'network_bridge',
      'network_model'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    // Only super_admin can change is_public status
    if (role === 'super_admin' && req.body.is_public !== undefined) {
      updateData.is_public = req.body.is_public;
    }

    const updated = await prisma.vm_templates.update({
      where: { id: Number(id) },
      data: updateData,
      include: {
        proxmox_clusters: true,
        companies: true
      }
    });

    logger.info(`Template updated: ${id}`);
    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Update template error:', error);
    res.status(500).json({ success: false, message: 'Failed to update template' });
  }
};

/**
 * Delete template
 */
export const deleteTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    // Check if template exists and user has access
    let where: any = { id: Number(id) };
    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
    }

    const existing = await prisma.vm_templates.findFirst({ where });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Template not found or access denied' });
      return;
    }

    // Check if template has any usage records
    const usageCount = await prisma.vm_template_usage.count({
      where: { template_id: Number(id) }
    });

    if (usageCount > 0) {
      res.status(400).json({
        success: false,
        message: `Cannot delete template: ${usageCount} VMs were created from this template`
      });
      return;
    }

    await prisma.vm_templates.delete({
      where: { id: Number(id) }
    });

    logger.info(`Template deleted: ${id}`);
    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (error) {
    logger.error('Delete template error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete template' });
  }
};

/**
 * Clone VM from template
 */
export const cloneFromTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { vm_name, target_vmid, target_node, company_id: reqCompanyId } = req.body;
    const { role, company_id: userCompanyId, id: userId } = req.user!;

    if (!vm_name || !target_vmid) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: vm_name, target_vmid'
      });
      return;
    }

    // Get template
    let templateWhere: any = { id: Number(id) };
    if (role !== 'super_admin' && userCompanyId !== null) {
      templateWhere = {
        AND: [
          { id: Number(id) },
          {
            OR: [
              { company_id: userCompanyId },
              { is_public: true }
            ]
          }
        ]
      };
    }

    const template = await prisma.vm_templates.findFirst({
      where: templateWhere,
      include: { proxmox_clusters: true }
    });

    if (!template) {
      res.status(404).json({ success: false, message: 'Template not found or access denied' });
      return;
    }

    // Determine company for new VM
    let finalCompanyId = null;
    if (role === 'super_admin') {
      finalCompanyId = reqCompanyId || null;
    } else {
      finalCompanyId = userCompanyId;
    }

    // Get cluster credentials
    const cluster = template.proxmox_clusters;
    if (!cluster.password_encrypted) {
      res.status(400).json({ success: false, message: 'Cluster credentials not configured' });
      return;
    }

    const password = decrypt(cluster.password_encrypted);
    const proxmox = new ProxmoxAPI(
      {
        host: cluster.host!,
        port: cluster.port!,
        username: cluster.username!
      },
      password
    );

    // Clone VM in Proxmox
    const node = target_node || template.node_name;

    try {
      await proxmox.cloneVM(template.node_name, Number(template.vmid), Number(target_vmid), vm_name);

      // Create VM record in database
      const newVM = await prisma.virtual_machines.create({
        data: {
          name: vm_name,
          vmid: target_vmid,
          node,
          cluster_id: template.cluster_id,
          company_id: finalCompanyId!,
          cpu_cores: template.cpu_cores || 2,
          memory_mb: template.memory_mb || 2048,
          storage_gb: template.disk_size_gb || 20,
          status: 'stopped',
          template_id: template.id,
          created_from_template: true
        }
      });

      // Record template usage
      await prisma.vm_template_usage.create({
        data: {
          template_id: template.id,
          vm_id: newVM.id,
          created_by: userId!
        }
      });

      logger.info(`VM ${newVM.id} created from template ${template.id}`);
      res.status(201).json({
        success: true,
        message: 'VM created from template successfully',
        data: newVM
      });
    } catch (proxmoxError: any) {
      logger.error('Proxmox clone error:', proxmoxError);
      res.status(500).json({
        success: false,
        message: 'Failed to clone VM in Proxmox: ' + proxmoxError.message
      });
    }
  } catch (error) {
    logger.error('Clone from template error:', error);
    res.status(500).json({ success: false, message: 'Failed to clone from template' });
  }
};
