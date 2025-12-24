// @ts-nocheck
// Template Management Controller for VDI
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get all template VMs for a cluster
 */
export const getTemplates = async (req: Request, res: Response): Promise<void> => {
  try {
    const { cluster_id } = req.query;

    const where: any = { is_template: true };
    if (cluster_id) {
      where.cluster_id = parseInt(cluster_id as string);
    }

    const templates = await prisma.virtual_machines.findMany({
      where,
      select: {
        id: true,
        name: true,
        vmid: true,
        node: true,
        cluster_id: true,
        status: true,
        is_template: true,
        cpu_cores: true,
        memory_mb: true,
        storage_gb: true,
        created_at: true
      },
      orderBy: { name: 'asc' }
    });

    res.json({
      success: true,
      data: templates
    });
  } catch (error: any) {
    console.error('[Templates] Get templates error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get single template details
 */
export const getTemplateDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const templateId = parseInt(id);

    if (isNaN(templateId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid template ID'
      });
    }

    const template = await prisma.virtual_machines.findUnique({
      where: { id: templateId },
      select: {
        id: true,
        name: true,
        vmid: true,
        node: true,
        cluster_id: true,
        status: true,
        is_template: true,
        cpu_cores: true,
        memory_mb: true,
        storage_gb: true,
        primary_ip_internal: true,
        primary_ip_external: true,
        created_at: true,
        updated_at: true
      }
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    res.json({
      success: true,
      data: template
    });
  } catch (error: any) {
    console.error('[Templates] Get template details error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Mark VM as template
 */
export const markAsTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const vmId = parseInt(id);

    if (isNaN(vmId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid VM ID'
      });
    }

    const vm = await prisma.virtual_machines.update({
      where: { id: vmId },
      data: {
        is_template: true,
        status: 'template'
      }
    });

    res.json({
      success: true,
      data: vm,
      message: 'VM marked as template successfully'
    });
  } catch (error: any) {
    console.error('[Templates] Mark as template error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Unmark VM as template
 */
export const unmarkAsTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id} = req.params;
    const vmId = parseInt(id);

    if (isNaN(vmId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid VM ID'
      });
    }

    const vm = await prisma.virtual_machines.update({
      where: { id: vmId },
      data: {
        is_template: false,
        status: 'stopped'
      }
    });

    res.json({
      success: true,
      data: vm,
      message: 'VM unmarked as template successfully'
    });
  } catch (error: any) {
    console.error('[Templates] Unmark as template error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
