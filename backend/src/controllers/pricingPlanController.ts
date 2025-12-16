/**
 * Pricing Plan Controller
 * Handles CRUD operations for pricing plans
 */

import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../config/database';
import logger from '../utils/logger';

/**
 * GET /api/pricing-plans
 * Get all pricing plans (filtered by permissions)
 */
export const getPricingPlans = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { role: true, company_id: true }
    });

    // Super admins see all plans, others see only global plans
    const whereClause = user?.role === 'super_admin'
      ? {} // All plans
      : { company_id: null, is_active: true }; // Only global active plans

    const plans = await prisma.pricing_plans.findMany({
      where: whereClause,
      orderBy: { display_order: 'asc' },
      include: {
        companies: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    res.json({ success: true, data: plans });
  } catch (error) {
    logger.error('Error getting pricing plans:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * GET /api/pricing-plans/:id
 * Get single pricing plan by ID
 */
export const getPricingPlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const planId = parseInt(req.params.id);

    const plan = await prisma.pricing_plans.findUnique({
      where: { id: planId },
      include: {
        companies: {
          select: {
            id: true,
            name: true
          }
        },
        company_billing: {
          include: {
            companies: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!plan) {
      res.status(404).json({ success: false, message: 'Pricing plan not found' });
      return;
    }

    res.json({ success: true, data: plan });
  } catch (error) {
    logger.error('Error getting pricing plan:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * POST /api/pricing-plans
 * Create new pricing plan (super_admin only)
 */
export const createPricingPlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    // Check if user is super_admin
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (user?.role !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Only super admins can create pricing plans'
      });
      return;
    }

    const {
      name,
      description,
      company_id,
      base_price,
      included_cpu_cores,
      included_memory_gb,
      included_storage_gb,
      overage_cpu_core_price,
      overage_memory_gb_price,
      overage_storage_gb_price,
      billing_cycle,
      is_active,
      is_default,
      display_order
    } = req.body;

    // Validate required fields
    if (!name || base_price === undefined) {
      res.status(400).json({
        success: false,
        message: 'Name and base_price are required'
      });
      return;
    }

    // If setting as default, unset other defaults
    if (is_default) {
      await prisma.pricing_plans.updateMany({
        where: { is_default: true },
        data: { is_default: false }
      });
    }

    const plan = await prisma.pricing_plans.create({
      data: {
        name,
        description,
        company_id: company_id || null,
        base_price,
        included_cpu_cores: included_cpu_cores ?? 2,
        included_memory_gb: included_memory_gb ?? 4,
        included_storage_gb: included_storage_gb ?? 50,
        overage_cpu_core_price: overage_cpu_core_price ?? 5.0,
        overage_memory_gb_price: overage_memory_gb_price ?? 2.0,
        overage_storage_gb_price: overage_storage_gb_price ?? 0.1,
        billing_cycle: billing_cycle || 'monthly',
        is_active: is_active ?? true,
        is_default: is_default ?? false,
        display_order: display_order ?? 0
      }
    });

    logger.info(`Pricing plan created: ${plan.name} (ID: ${plan.id}) by user ${userId}`);

    res.json({
      success: true,
      message: 'Pricing plan created successfully',
      data: plan
    });
  } catch (error) {
    logger.error('Error creating pricing plan:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * PUT /api/pricing-plans/:id
 * Update pricing plan (super_admin only)
 */
export const updatePricingPlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const planId = parseInt(req.params.id);

    // Check if user is super_admin
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (user?.role !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Only super admins can update pricing plans'
      });
      return;
    }

    const existingPlan = await prisma.pricing_plans.findUnique({
      where: { id: planId }
    });

    if (!existingPlan) {
      res.status(404).json({ success: false, message: 'Pricing plan not found' });
      return;
    }

    const {
      name,
      description,
      company_id,
      base_price,
      included_cpu_cores,
      included_memory_gb,
      included_storage_gb,
      overage_cpu_core_price,
      overage_memory_gb_price,
      overage_storage_gb_price,
      billing_cycle,
      is_active,
      is_default,
      display_order
    } = req.body;

    // If setting as default, unset other defaults
    if (is_default && !existingPlan.is_default) {
      await prisma.pricing_plans.updateMany({
        where: { is_default: true },
        data: { is_default: false }
      });
    }

    const plan = await prisma.pricing_plans.update({
      where: { id: planId },
      data: {
        name: name ?? existingPlan.name,
        description: description !== undefined ? description : existingPlan.description,
        company_id: company_id !== undefined ? company_id : existingPlan.company_id,
        base_price: base_price ?? existingPlan.base_price,
        included_cpu_cores: included_cpu_cores ?? existingPlan.included_cpu_cores,
        included_memory_gb: included_memory_gb ?? existingPlan.included_memory_gb,
        included_storage_gb: included_storage_gb ?? existingPlan.included_storage_gb,
        overage_cpu_core_price: overage_cpu_core_price ?? existingPlan.overage_cpu_core_price,
        overage_memory_gb_price: overage_memory_gb_price ?? existingPlan.overage_memory_gb_price,
        overage_storage_gb_price: overage_storage_gb_price ?? existingPlan.overage_storage_gb_price,
        billing_cycle: billing_cycle ?? existingPlan.billing_cycle,
        is_active: is_active ?? existingPlan.is_active,
        is_default: is_default ?? existingPlan.is_default,
        display_order: display_order ?? existingPlan.display_order
      }
    });

    logger.info(`Pricing plan updated: ${plan.name} (ID: ${plan.id}) by user ${userId}`);

    res.json({
      success: true,
      message: 'Pricing plan updated successfully',
      data: plan
    });
  } catch (error) {
    logger.error('Error updating pricing plan:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * DELETE /api/pricing-plans/:id
 * Delete pricing plan (super_admin only)
 */
export const deletePricingPlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const planId = parseInt(req.params.id);

    // Check if user is super_admin
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (user?.role !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Only super admins can delete pricing plans'
      });
      return;
    }

    // Check if plan is in use
    const companiesUsingPlan = await prisma.company_billing.count({
      where: { current_pricing_plan_id: planId }
    });

    if (companiesUsingPlan > 0) {
      res.status(400).json({
        success: false,
        message: `Cannot delete pricing plan. It is currently assigned to ${companiesUsingPlan} company(ies).`
      });
      return;
    }

    await prisma.pricing_plans.delete({
      where: { id: planId }
    });

    logger.info(`Pricing plan deleted: ID ${planId} by user ${userId}`);

    res.json({
      success: true,
      message: 'Pricing plan deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting pricing plan:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * POST /api/pricing-plans/:id/assign
 * Assign pricing plan to a company (super_admin only)
 */
export const assignPricingPlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const planId = parseInt(req.params.id);
    const { company_id } = req.body;

    // Check if user is super_admin
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (user?.role !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Only super admins can assign pricing plans'
      });
      return;
    }

    if (!company_id) {
      res.status(400).json({
        success: false,
        message: 'company_id is required'
      });
      return;
    }

    // Check if plan exists
    const plan = await prisma.pricing_plans.findUnique({
      where: { id: planId }
    });

    if (!plan) {
      res.status(404).json({ success: false, message: 'Pricing plan not found' });
      return;
    }

    // Check if company exists
    const company = await prisma.companies.findUnique({
      where: { id: company_id }
    });

    if (!company) {
      res.status(404).json({ success: false, message: 'Company not found' });
      return;
    }

    // Update company_billing record
    const billing = await prisma.company_billing.upsert({
      where: { company_id },
      update: {
        current_pricing_plan_id: planId
      },
      create: {
        company_id,
        billing_email: `billing@${company.name.toLowerCase().replace(/\s+/g, '')}.com`,
        current_pricing_plan_id: planId
      }
    });

    // Create assignment record in company_pricing_plans
    await prisma.company_pricing_plans.create({
      data: {
        company_id,
        pricing_plan_id: planId,
        effective_date: new Date(),
        is_active: true,
        assigned_by: userId
      }
    });

    logger.info(`Pricing plan ${planId} assigned to company ${company_id} by user ${userId}`);

    res.json({
      success: true,
      message: `Pricing plan "${plan.name}" assigned to company "${company.name}" successfully`,
      data: billing
    });
  } catch (error) {
    logger.error('Error assigning pricing plan:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * GET /api/pricing-plans/:id/companies
 * Get companies using a specific pricing plan
 */
export const getCompaniesUsingPlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const planId = parseInt(req.params.id);

    const companies = await prisma.company_billing.findMany({
      where: { current_pricing_plan_id: planId },
      include: {
        companies: {
          select: {
            id: true,
            name: true,
            status: true,
            billing_active: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: companies.map(cb => cb.companies)
    });
  } catch (error) {
    logger.error('Error getting companies using plan:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export default {
  getPricingPlans,
  getPricingPlan,
  createPricingPlan,
  updatePricingPlan,
  deletePricingPlan,
  assignPricingPlan,
  getCompaniesUsingPlan
};
