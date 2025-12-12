import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../config/database';
import logger from '../utils/logger';

/**
 * Get all pricing tiers with filtering
 */
export const getPricingTiers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { companyId, projectId, tierType, activeOnly = 'true' } = req.query;

    let where: any = {};

    // Super admin can see all pricing
    if (role === 'super_admin') {
      if (companyId) {
        where.company_id = Number(companyId);
      }
      if (projectId) {
        where.project_id = Number(projectId);
      }
    } else {
      // Regular users see their company pricing + defaults
      where.OR = [
        { company_id: company_id },
        { company_id: null, project_id: null }
      ];
    }

    if (tierType) {
      where.tier_type = tierType;
    }

    if (activeOnly === 'true') {
      where.active = true;
    }

    const pricingTiers = await prisma.pricing_tiers.findMany({
      where,
      include: {
        companies: {
          select: {
            id: true,
            name: true
          }
        },
        vm_projects: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { created_at: 'desc' }
      ]
    });

    res.json({
      success: true,
      data: pricingTiers
    });
  } catch (error: any) {
    logger.error('Get pricing tiers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pricing tiers',
      error: error.message
    });
  }
};

/**
 * Get a single pricing tier by ID
 */
export const getPricingTier = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { id } = req.params;

    const pricingTier = await prisma.pricing_tiers.findUnique({
      where: { id: Number(id) },
      include: {
        companies: {
          select: {
            id: true,
            name: true
          }
        },
        vm_projects: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!pricingTier) {
      res.status(404).json({ success: false, message: 'Pricing tier not found' });
      return;
    }

    // Access control
    if (role !== 'super_admin') {
      if (pricingTier.company_id && pricingTier.company_id !== company_id) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }
    }

    res.json({
      success: true,
      data: pricingTier
    });
  } catch (error: any) {
    logger.error('Get pricing tier error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pricing tier',
      error: error.message
    });
  }
};

/**
 * Create a new pricing tier
 */
export const createPricingTier = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const {
      name,
      description,
      tier_type,
      company_id: targetCompanyId,
      project_id,
      unit_price,
      currency = 'USD',
      billing_cycle = 'monthly',
      min_units,
      max_units,
      overage_price,
      is_default = false,
      priority = 0,
      active = true
    } = req.body;

    // Validation
    if (!name || !tier_type || unit_price === undefined) {
      res.status(400).json({
        success: false,
        message: 'Name, tier_type, and unit_price are required'
      });
      return;
    }

    // Only super_admin can create default pricing or pricing for other companies
    if (role !== 'super_admin') {
      if (is_default || (targetCompanyId && targetCompanyId !== company_id)) {
        res.status(403).json({
          success: false,
          message: 'Access denied. Only super admin can create default or cross-company pricing.'
        });
        return;
      }
    }

    // If default, ensure company_id and project_id are null
    const finalCompanyId = is_default ? null : (targetCompanyId || company_id);
    const finalProjectId = is_default ? null : project_id;

    // Validate project belongs to company if both are specified
    if (finalProjectId && finalCompanyId) {
      const project = await prisma.vm_projects.findUnique({
        where: { id: Number(finalProjectId) },
        select: { id: true, company_id: true, name: true }
      });

      if (!project) {
        res.status(400).json({
          success: false,
          message: 'Project not found'
        });
        return;
      }

      if (project.company_id !== Number(finalCompanyId)) {
        res.status(400).json({
          success: false,
          message: `Project "${project.name}" does not belong to the selected company`
        });
        return;
      }
    }

    const pricingTier = await prisma.pricing_tiers.create({
      data: {
        name,
        description,
        tier_type,
        company_id: finalCompanyId,
        project_id: finalProjectId,
        unit_price: Number(unit_price),
        currency,
        billing_cycle,
        min_units: min_units ? Number(min_units) : null,
        max_units: max_units ? Number(max_units) : null,
        overage_price: overage_price ? Number(overage_price) : null,
        is_default,
        priority: Number(priority),
        active
      },
      include: {
        companies: {
          select: {
            id: true,
            name: true
          }
        },
        vm_projects: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    logger.info(`Pricing tier created: ${pricingTier.id} - ${pricingTier.name}`);

    res.status(201).json({
      success: true,
      message: 'Pricing tier created successfully',
      data: pricingTier
    });
  } catch (error: any) {
    logger.error('Create pricing tier error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create pricing tier',
      error: error.message
    });
  }
};

/**
 * Update a pricing tier
 */
export const updatePricingTier = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { id } = req.params;
    const {
      name,
      description,
      tier_type,
      company_id: targetCompanyId,
      project_id,
      unit_price,
      currency,
      billing_cycle,
      min_units,
      max_units,
      overage_price,
      is_default,
      priority,
      active
    } = req.body;

    // Check if pricing tier exists
    const existing = await prisma.pricing_tiers.findUnique({
      where: { id: Number(id) }
    });

    if (!existing) {
      res.status(404).json({ success: false, message: 'Pricing tier not found' });
      return;
    }

    // Access control
    if (role !== 'super_admin') {
      // Non-admin can only edit their company's pricing
      if (existing.company_id !== company_id) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }
      // Non-admin cannot make pricing default
      if (is_default && !existing.is_default) {
        res.status(403).json({
          success: false,
          message: 'Only super admin can create default pricing'
        });
        return;
      }
    }

    // Validate project belongs to company if both are being set
    const finalCompanyId = targetCompanyId !== undefined ? targetCompanyId : existing.company_id;
    const finalProjectId = project_id !== undefined ? project_id : existing.project_id;

    if (finalProjectId && finalCompanyId) {
      const project = await prisma.vm_projects.findUnique({
        where: { id: Number(finalProjectId) },
        select: { id: true, company_id: true, name: true }
      });

      if (!project) {
        res.status(400).json({
          success: false,
          message: 'Project not found'
        });
        return;
      }

      if (project.company_id !== Number(finalCompanyId)) {
        res.status(400).json({
          success: false,
          message: `Project "${project.name}" does not belong to the selected company`
        });
        return;
      }
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (tier_type !== undefined) updateData.tier_type = tier_type;
    if (targetCompanyId !== undefined) updateData.company_id = targetCompanyId;
    if (project_id !== undefined) updateData.project_id = project_id;
    if (unit_price !== undefined) updateData.unit_price = Number(unit_price);
    if (currency !== undefined) updateData.currency = currency;
    if (billing_cycle !== undefined) updateData.billing_cycle = billing_cycle;
    if (min_units !== undefined) updateData.min_units = min_units ? Number(min_units) : null;
    if (max_units !== undefined) updateData.max_units = max_units ? Number(max_units) : null;
    if (overage_price !== undefined) updateData.overage_price = overage_price ? Number(overage_price) : null;
    if (is_default !== undefined) updateData.is_default = is_default;
    if (priority !== undefined) updateData.priority = Number(priority);
    if (active !== undefined) updateData.active = active;

    const updated = await prisma.pricing_tiers.update({
      where: { id: Number(id) },
      data: updateData,
      include: {
        companies: {
          select: {
            id: true,
            name: true
          }
        },
        vm_projects: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    logger.info(`Pricing tier updated: ${updated.id} - ${updated.name}`);

    res.json({
      success: true,
      message: 'Pricing tier updated successfully',
      data: updated
    });
  } catch (error: any) {
    logger.error('Update pricing tier error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update pricing tier',
      error: error.message
    });
  }
};

/**
 * Delete a pricing tier
 */
export const deletePricingTier = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { id } = req.params;

    const existing = await prisma.pricing_tiers.findUnique({
      where: { id: Number(id) }
    });

    if (!existing) {
      res.status(404).json({ success: false, message: 'Pricing tier not found' });
      return;
    }

    // Access control
    if (role !== 'super_admin') {
      if (existing.company_id !== company_id) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }
      if (existing.is_default) {
        res.status(403).json({
          success: false,
          message: 'Only super admin can delete default pricing'
        });
        return;
      }
    }

    await prisma.pricing_tiers.delete({
      where: { id: Number(id) }
    });

    logger.info(`Pricing tier deleted: ${id}`);

    res.json({
      success: true,
      message: 'Pricing tier deleted successfully'
    });
  } catch (error: any) {
    logger.error('Delete pricing tier error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete pricing tier',
      error: error.message
    });
  }
};

/**
 * Get available tier types
 */
export const getTierTypes = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tierTypes = [
      { value: 'vm_base', label: 'VM Base Cost', description: 'Base cost per VM' },
      { value: 'cpu_core', label: 'CPU Core', description: 'Cost per CPU core' },
      { value: 'memory_gb', label: 'Memory (GB)', description: 'Cost per GB of RAM' },
      { value: 'storage_gb', label: 'Storage (GB)', description: 'Cost per GB of storage' },
      { value: 'bandwidth_gb', label: 'Bandwidth (GB)', description: 'Cost per GB of bandwidth' },
      { value: 'backup_gb', label: 'Backup Storage (GB)', description: 'Cost per GB of backup storage' },
      { value: 'snapshot', label: 'Snapshot', description: 'Cost per snapshot' },
      { value: 'ip_range', label: 'IP Range', description: 'Cost per IP range' },
      { value: 'opnsense_instance', label: 'OPNsense Instance', description: 'Cost per OPNsense firewall' },
      { value: 'support_hours', label: 'Support Hours', description: 'Cost per support hour' }
    ];

    res.json({
      success: true,
      data: tierTypes
    });
  } catch (error: any) {
    logger.error('Get tier types error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tier types',
      error: error.message
    });
  }
};
