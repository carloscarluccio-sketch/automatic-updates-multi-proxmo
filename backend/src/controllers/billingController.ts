/**
 * Billing Controller
 * Handles all billing-related API endpoints
 */

import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../config/database';
import logger from '../utils/logger';
import {
  createDailyVMSnapshots,
  calculateMonthlyBill,
  generateInvoice,
  generateMonthlyInvoices,
  getVMCost
} from '../services/billingCalculationService';

/**
 * GET /api/billing/estimate
 * Get current month cost estimate for authenticated user's company
 */
export const getBillingEstimate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    // Get user's company
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { company_id: true, role: true }
    });

    if (!user || !user.company_id) {
      res.status(400).json({ success: false, message: 'User not associated with a company' });
      return;
    }

    const companyId = user.role === 'super_admin' && req.query.company_id
      ? parseInt(req.query.company_id as string)
      : user.company_id;

    // Calculate current month bill
    const currentMonth = new Date();
    const estimate = await calculateMonthlyBill(companyId, currentMonth);

    if (!estimate) {
      res.status(404).json({
        success: false,
        message: 'No billing estimate available. Company may not have a pricing plan assigned.'
      });
      return;
    }

    res.json({ success: true, data: estimate });
  } catch (error) {
    logger.error('Error getting billing estimate:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * GET /api/billing/vm-costs
 * Get per-VM cost breakdown for current month
 */
export const getVMCosts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { company_id: true, role: true }
    });

    if (!user || !user.company_id) {
      res.status(400).json({ success: false, message: 'User not associated with a company' });
      return;
    }

    const companyId = user.role === 'super_admin' && req.query.company_id
      ? parseInt(req.query.company_id as string)
      : user.company_id;

    // Get billing info
    const billing = await prisma.company_billing.findUnique({
      where: { company_id: companyId }
    });

    if (!billing || !billing.current_pricing_plan_id) {
      res.status(404).json({
        success: false,
        message: 'No pricing plan assigned to company'
      });
      return;
    }

    // Get all VMs
    const vms = await prisma.virtual_machines.findMany({
      where: {
        company_id: companyId,
        status: { not: 'deleted' }
      },
      select: {
        id: true,
        name: true,
        vmid: true
      }
    });

    // Calculate cost for each VM
    const currentMonth = new Date();
    const vmCosts = [];

    for (const vm of vms) {
      const cost = await getVMCost(vm.id, billing.current_pricing_plan_id, currentMonth);
      if (cost) {
        vmCosts.push(cost);
      }
    }

    res.json({ success: true, data: vmCosts });
  } catch (error) {
    logger.error('Error getting VM costs:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * GET /api/billing/history
 * Get invoice history for company
 */
export const getBillingHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { company_id: true, role: true }
    });

    if (!user || !user.company_id) {
      res.status(400).json({ success: false, message: 'User not associated with a company' });
      return;
    }

    const companyId = user.role === 'super_admin' && req.query.company_id
      ? parseInt(req.query.company_id as string)
      : user.company_id;

    // Get invoices with line items
    const invoices = await prisma.invoices.findMany({
      where: { company_id: companyId },
      include: {
        invoice_line_items: true
      },
      orderBy: {
        billing_period_start: 'desc'
      }
    });

    res.json({ success: true, data: invoices });
  } catch (error) {
    logger.error('Error getting billing history:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * GET /api/billing/pricing-plans
 * Get available pricing plans
 */
export const getPricingPlans = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { company_id: true, role: true }
    });

    // Super admins can see all plans, regular users see only global plans
    const whereClause = user?.role === 'super_admin'
      ? { is_active: true }
      : { is_active: true, company_id: null };

    const plans = await prisma.pricing_plans.findMany({
      where: whereClause,
      orderBy: { display_order: 'asc' }
    });

    res.json({ success: true, data: plans });
  } catch (error) {
    logger.error('Error getting pricing plans:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * POST /api/billing/generate-invoice
 * Manually generate invoice for a company (super_admin only)
 */
export const generateInvoiceManually = async (req: AuthRequest, res: Response): Promise<void> => {
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
        message: 'Only super admins can manually generate invoices'
      });
      return;
    }

    const { company_id, billing_month } = req.body;

    if (!company_id) {
      res.status(400).json({
        success: false,
        message: 'company_id is required'
      });
      return;
    }

    const billingDate = billing_month ? new Date(billing_month) : new Date();

    const invoiceId = await generateInvoice(company_id, billingDate, userId);

    if (!invoiceId) {
      res.status(400).json({
        success: false,
        message: 'Could not generate invoice. Check if company has active billing and pricing plan.'
      });
      return;
    }

    // Fetch created invoice with line items
    const invoice = await prisma.invoices.findUnique({
      where: { id: invoiceId },
      include: {
        invoice_line_items: true
      }
    });

    res.json({
      success: true,
      message: 'Invoice generated successfully',
      data: invoice
    });
  } catch (error) {
    logger.error('Error generating invoice manually:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * POST /api/billing/snapshots/daily
 * Trigger daily VM snapshots (cron job endpoint - super_admin only)
 */
export const triggerDailySnapshots = async (req: AuthRequest, res: Response): Promise<void> => {
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
        message: 'Only super admins can trigger snapshot creation'
      });
      return;
    }

    await createDailyVMSnapshots();

    res.json({
      success: true,
      message: 'Daily VM snapshots created successfully'
    });
  } catch (error) {
    logger.error('Error triggering daily snapshots:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * POST /api/billing/invoices/generate-monthly
 * Trigger monthly invoice generation for all due companies (cron job endpoint - super_admin only)
 */
export const triggerMonthlyInvoices = async (req: AuthRequest, res: Response): Promise<void> => {
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
        message: 'Only super admins can trigger monthly invoice generation'
      });
      return;
    }

    await generateMonthlyInvoices();

    res.json({
      success: true,
      message: 'Monthly invoices generated successfully'
    });
  } catch (error) {
    logger.error('Error triggering monthly invoices:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export default {
  getBillingEstimate,
  getVMCosts,
  getBillingHistory,
  getPricingPlans,
  generateInvoiceManually,
  triggerDailySnapshots,
  triggerMonthlyInvoices
};

/**
 * GET /api/billing/all-companies
 * Get billing overview for all companies (super_admin only)
 */
export const getAllCompaniesBilling = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    // Verify super_admin role
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (!user || user.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Access denied. Super admin only.' });
      return;
    }

    // Get all companies with their VMs
    const companies = await prisma.companies.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        name: true,
        virtual_machines: {
          where: { status: { not: 'deleted' } },
          select: {
            id: true,
            cpu_cores: true,
            memory_mb: true,
            storage_gb: true,
            status: true
          }
        },
        company_billing: {
          select: {
            current_pricing_plan_id: true,
            pricing_plans: {
              select: {
                overage_cpu_core_price: true,
                overage_memory_gb_price: true,
                overage_storage_gb_price: true,
              }
            }
          }
        }
      }
    });

    const companiesData = companies.map(company => {
      const vms = company.virtual_machines;
      const runningVms = vms.filter(vm => vm.status === 'running').length;
      const totalCpu = vms.reduce((sum, vm) => sum + (vm.cpu_cores || 0), 0);
      const totalMemoryGb = vms.reduce((sum, vm) => sum + (vm.memory_mb || 0), 0) / 1024;
      const totalStorageGb = vms.reduce((sum, vm) => sum + (vm.storage_gb || 0), 0);

      // Calculate estimated monthly cost
      let estimatedMonthlyCost = 0;
      if (company.company_billing && company.company_billing.pricing_plans) {
        const plan = company.company_billing.pricing_plans;
        estimatedMonthlyCost = 
          (totalCpu * (plan.overage_cpu_core_price || 0)) +
          (totalMemoryGb * (plan.overage_memory_gb_price || 0)) +
          (totalStorageGb * (plan.overage_storage_gb_price || 0));
      }

      return {
        company_id: company.id,
        company_name: company.name,
        vm_count: vms.length,
        running_vms: runningVms,
        total_cpu: totalCpu,
        total_memory_gb: Math.round(totalMemoryGb * 100) / 100,
        total_storage_gb: Math.round(totalStorageGb * 100) / 100,
        estimated_monthly_cost: Math.round(estimatedMonthlyCost * 100) / 100
      };
    });

    const totalEstimatedRevenue = companiesData.reduce((sum, c) => sum + c.estimated_monthly_cost, 0);
    const currency = 'USD';

    res.json({
      success: true,
      data: {
        companies: companiesData,
        summary: {
          total_companies: companiesData.length,
          total_estimated_revenue: Math.round(totalEstimatedRevenue * 100) / 100,
          currency: currency
        }
      }
    });
  } catch (error) {
    logger.error('Error getting all companies billing:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
