import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middlewares/auth';
import logger from '../utils/logger';
import { decrypt } from '../utils/encryption';

export const getInstances = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { cluster_id, project_id } = req.query;
    let where: any = {};
    if (role !== 'super_admin' && company_id !== null) where.company_id = company_id;
    if (cluster_id) where.cluster_id = Number(cluster_id);
    if (project_id) where.project_id = Number(project_id);

    const instances = await prisma.opnsense_instances.findMany({
      where,
      include: {
        companies: { select: { id: true, name: true } },
        proxmox_clusters: { select: { id: true, name: true, host: true } },
        virtual_machines: { select: { id: true, name: true, status: true } },
        opnsense_templates: { select: { id: true, name: true } }
      },
      orderBy: { created_at: 'desc' }
    });

    const instancesData = instances.map(inst => ({
      ...inst,
      admin_password: inst.admin_password ? decrypt(inst.admin_password) : null
    }));

    res.json({ success: true, data: instancesData });
  } catch (error: any) {
    logger.error('Get OPNsense instances error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch OPNsense instances', error: error.message });
  }
};

export const getInstance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;
    let where: any = { id: Number(id) };
    if (role !== 'super_admin' && company_id !== null) where.company_id = company_id;

    const instance = await prisma.opnsense_instances.findFirst({
      where,
      include: {
        companies: true,
        proxmox_clusters: true,
        virtual_machines: true,
        opnsense_templates: true
      }
    });

    if (!instance) {
      res.status(404).json({ success: false, message: 'OPNsense instance not found' });
      return;
    }

    const data = {
      ...instance,
      admin_password: instance.admin_password ? decrypt(instance.admin_password) : null
    };

    res.json({ success: true, data });
  } catch (error: any) {
    logger.error('Get OPNsense instance error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch instance', error: error.message });
  }
};

export const getTemplates = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const templates = await prisma.opnsense_templates.findMany({ orderBy: { created_at: 'desc' } });
    res.json({ success: true, data: templates });
  } catch (error: any) {
    logger.error('Get OPNsense templates error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch templates', error: error.message });
  }
};

/**
 * NEW: Download OPNsense config.xml for an instance
 * GET /api/opnsense/:id/config/download
 */
export const downloadConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    // Fetch instance with permission check
    let where: any = { id: Number(id) };
    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
    }

    const instance = await prisma.opnsense_instances.findFirst({
      where,
      include: {
        companies: { select: { name: true } },
        virtual_machines: { select: { name: true } }
      }
    });

    if (!instance) {
      res.status(404).json({ success: false, message: 'OPNsense instance not found or access denied' });
      return;
    }

    // Check if config exists
    if (!instance.config_xml) {
      res.status(404).json({ success: false, message: 'No configuration available for this instance' });
      return;
    }

    // Generate filename
    const vmName = instance.virtual_machines?.name || `opnsense-${instance.id}`;
    const companyName = instance.companies?.name.replace(/[^a-zA-Z0-9]/g, '_') || 'unknown';
    const filename = `${companyName}_${vmName}_config.xml`;

    // Set headers for file download
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', Buffer.byteLength(instance.config_xml));

    logger.info(`OPNsense config downloaded: Instance ${id} by user ${req.user!.id}`);

    // Send the XML content
    res.send(instance.config_xml);
  } catch (error: any) {
    logger.error('Download OPNsense config error:', error);
    res.status(500).json({ success: false, message: 'Failed to download configuration', error: error.message });
  }
};

/**
 * NEW: Get config.xml content (for preview/viewing)
 * GET /api/opnsense/:id/config
 */
export const getConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    let where: any = { id: Number(id) };
    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
    }

    const instance = await prisma.opnsense_instances.findFirst({
      where,
      select: {
        id: true,
        config_xml: true,
        config_generated_at: true,
        deployment_status: true
      }
    });

    if (!instance) {
      res.status(404).json({ success: false, message: 'OPNsense instance not found or access denied' });
      return;
    }

    if (!instance.config_xml) {
      res.status(404).json({ success: false, message: 'No configuration available' });
      return;
    }

    res.json({
      success: true,
      data: {
        id: instance.id,
        config_xml: instance.config_xml,
        config_generated_at: instance.config_generated_at,
        deployment_status: instance.deployment_status
      }
    });
  } catch (error: any) {
    logger.error('Get OPNsense config error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch configuration', error: error.message });
  }
};
