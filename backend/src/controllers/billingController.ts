import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../config/database';
import logger from '../utils/logger';

/**
 * Get pricing for a specific resource type with hierarchical lookup
 * Priority: project-specific > company-specific > default
 */
async function getPricingForResource(
  tierType: string,
  companyId: number,
  projectId?: number | null
): Promise<number> {
  // Try to find pricing with priority order
  const pricing = await prisma.pricing_tiers.findFirst({
    where: {
      tier_type: tierType as any,
      active: true,
      OR: [
        // Project-specific pricing (highest priority)
        ...(projectId ? [{ project_id: projectId }] : []),
        // Company-specific pricing
        { company_id: companyId, project_id: null },
        // Default pricing (lowest priority)
        { company_id: null, project_id: null, is_default: true }
      ]
    },
    orderBy: {
      priority: 'desc' // Higher priority first
    }
  });

  return pricing ? Number(pricing.unit_price) : 0;
}

/**
 * Get billing overview for company with database-driven pricing
 */
export const getBillingOverview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { companyId, projectId } = req.query;

    let targetCompanyId: number | null = null;
    let targetProjectId: number | null = projectId ? Number(projectId) : null;

    if (role === 'super_admin') {
      targetCompanyId = companyId ? Number(companyId) : null;
    } else {
      targetCompanyId = company_id;
    }

    if (!targetCompanyId) {
      res.status(400).json({ success: false, message: 'Company ID is required' });
      return;
    }

    // Get VM count and resource totals
    const vmWhere: any = { company_id: targetCompanyId };
    if (targetProjectId) {
      vmWhere.project_id = targetProjectId;
    }

    const vms = await prisma.virtual_machines.findMany({
      where: vmWhere,
      select: {
        id: true,
        cpu_cores: true,
        memory_mb: true,
        storage_gb: true,
        status: true,
        project_id: true
      }
    });

    const totalVMs = vms.length;
    const runningVMs = vms.filter(vm => vm.status === 'running').length;
    const totalCPU = vms.reduce((sum, vm) => sum + (vm.cpu_cores || 0), 0);
    const totalMemoryGB = vms.reduce((sum, vm) => sum + (vm.memory_mb || 0) / 1024, 0);
    const totalStorageGB = vms.reduce((sum, vm) => sum + (vm.storage_gb || 0), 0);

    // Get IP range count
    const ipRangesWhere: any = { company_id: targetCompanyId };
    const ipRanges = await prisma.ip_ranges.findMany({
      where: ipRangesWhere
    });

    // Get OPNsense instances count
    const opnsenseWhere: any = { company_id: targetCompanyId };
    if (targetProjectId) {
      opnsenseWhere.project_id = targetProjectId;
    }
    const opnsenseInstances = await prisma.opnsense_instances.findMany({
      where: opnsenseWhere
    });

    // Get pricing from database (hierarchical: project > company > default)
    const pricing = {
      vm_base: await getPricingForResource('vm_base', targetCompanyId, targetProjectId),
      cpu_core: await getPricingForResource('cpu_core', targetCompanyId, targetProjectId),
      memory_gb: await getPricingForResource('memory_gb', targetCompanyId, targetProjectId),
      storage_gb: await getPricingForResource('storage_gb', targetCompanyId, targetProjectId),
      ip_range: await getPricingForResource('ip_range', targetCompanyId, targetProjectId),
      opnsense_instance: await getPricingForResource('opnsense_instance', targetCompanyId, targetProjectId),
      bandwidth_gb: await getPricingForResource('bandwidth_gb', targetCompanyId, targetProjectId),
      backup_gb: await getPricingForResource('backup_gb', targetCompanyId, targetProjectId),
      snapshot: await getPricingForResource('snapshot', targetCompanyId, targetProjectId)
    };

    // Calculate monthly costs using database pricing
    const monthlyCost = {
      vms: totalVMs * pricing.vm_base,
      cpu: totalCPU * pricing.cpu_core,
      memory: totalMemoryGB * pricing.memory_gb,
      storage: totalStorageGB * pricing.storage_gb,
      ip_ranges: ipRanges.length * pricing.ip_range,
      opnsense: opnsenseInstances.length * pricing.opnsense_instance
    };

    const totalMonthlyCost = Object.values(monthlyCost).reduce((sum, cost) => sum + cost, 0);

    // Get pricing tier details for transparency
    const pricingTiers = await prisma.pricing_tiers.findMany({
      where: {
        active: true,
        OR: [
          { project_id: targetProjectId },
          { company_id: targetCompanyId, project_id: null },
          { company_id: null, project_id: null, is_default: true }
        ]
      },
      select: {
        id: true,
        name: true,
        tier_type: true,
        unit_price: true,
        currency: true,
        billing_cycle: true,
        priority: true,
        is_default: true,
        company_id: true,
        project_id: true
      },
      orderBy: [
        { tier_type: 'asc' },
        { priority: 'desc' }
      ]
    });

    res.json({
      success: true,
      data: {
        company_id: targetCompanyId,
        project_id: targetProjectId,
        resources: {
          total_vms: totalVMs,
          running_vms: runningVMs,
          total_cpu_cores: totalCPU,
          total_memory_gb: Math.round(totalMemoryGB * 100) / 100,
          total_storage_gb: totalStorageGB,
          ip_ranges: ipRanges.length,
          opnsense_instances: opnsenseInstances.length
        },
        costs: {
          breakdown: monthlyCost,
          total_monthly: Math.round(totalMonthlyCost * 100) / 100,
          currency: 'USD'
        },
        pricing,
        pricing_tiers: pricingTiers
      }
    });
  } catch (error: any) {
    logger.error('Get billing overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch billing overview',
      error: error.message
    });
  }
};

/**
 * Get resource usage history
 */
export const getUsageHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { companyId, startDate, endDate, limit = 30 } = req.query;

    let targetCompanyId: number | null = null;

    if (role === 'super_admin') {
      targetCompanyId = companyId ? Number(companyId) : null;
    } else {
      targetCompanyId = company_id;
    }

    if (!targetCompanyId) {
      res.status(400).json({ success: false, message: 'Company ID is required' });
      return;
    }

    // Build date filter
    const where: any = { company_id: targetCompanyId };
    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at.gte = new Date(startDate as string);
      if (endDate) where.created_at.lte = new Date(endDate as string);
    }

    // Get VM creation/deletion history from activity logs
    const activities = await prisma.activity_logs.findMany({
      where: {
        ...where,
        activity_type: 'vm_management',
        action: { in: ['create', 'delete'] }
      },
      orderBy: { created_at: 'desc' },
      take: Number(limit)
    });

    // Get current snapshot
    const currentVMs = await prisma.virtual_machines.findMany({
      where: { company_id: targetCompanyId },
      select: {
        id: true,
        name: true,
        cpu_cores: true,
        memory_mb: true,
        storage_gb: true,
        status: true,
        created_at: true,
        project_id: true
      }
    });

    // Get usage_tracking data if available
    const usageTracking = await prisma.usage_tracking.findMany({
      where: {
        company_id: targetCompanyId,
        ...(startDate || endDate ? {
          billing_period_start: {
            ...(startDate ? { gte: new Date(startDate as string) } : {}),
            ...(endDate ? { lte: new Date(endDate as string) } : {})
          }
        } : {})
      },
      orderBy: { billing_period_start: 'desc' },
      take: Number(limit)
    });

    res.json({
      success: true,
      data: {
        company_id: targetCompanyId,
        current_resources: {
          vm_count: currentVMs.length,
          vms: currentVMs
        },
        history: activities,
        usage_tracking: usageTracking,
        period: {
          start: startDate || null,
          end: endDate || null
        }
      }
    });
  } catch (error: any) {
    logger.error('Get usage history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch usage history',
      error: error.message
    });
  }
};

/**
 * Get billing report for all companies (super_admin only)
 */
export const getAllCompaniesBilling = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role } = req.user!;

    if (role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Access denied. Super admin only.' });
      return;
    }

    const companies = await prisma.companies.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        name: true
      }
    });

    const billingData = [];

    for (const company of companies) {
      // Get VM stats
      const vms = await prisma.virtual_machines.findMany({
        where: { company_id: company.id },
        select: {
          cpu_cores: true,
          memory_mb: true,
          storage_gb: true,
          status: true
        }
      });

      const totalCPU = vms.reduce((sum, vm) => sum + (vm.cpu_cores || 0), 0);
      const totalMemoryGB = vms.reduce((sum, vm) => sum + (vm.memory_mb || 0) / 1024, 0);
      const totalStorageGB = vms.reduce((sum, vm) => sum + (vm.storage_gb || 0), 0);

      // Get company-specific or default pricing
      const vmBasePrice = await getPricingForResource('vm_base', company.id);
      const cpuPrice = await getPricingForResource('cpu_core', company.id);
      const memoryPrice = await getPricingForResource('memory_gb', company.id);
      const storagePrice = await getPricingForResource('storage_gb', company.id);

      // Calculate cost with database pricing
      const estimatedCost =
        (vms.length * vmBasePrice) +
        (totalCPU * cpuPrice) +
        (totalMemoryGB * memoryPrice) +
        (totalStorageGB * storagePrice);

      billingData.push({
        company_id: company.id,
        company_name: company.name,
        resources: {
          vms: vms.length,
          running_vms: vms.filter(vm => vm.status === 'running').length,
          cpu_cores: totalCPU,
          memory_gb: Math.round(totalMemoryGB * 100) / 100,
          storage_gb: totalStorageGB
        },
        estimated_monthly_cost: Math.round(estimatedCost * 100) / 100,
        currency: 'USD'
      });
    }

    const totalRevenue = billingData.reduce((sum, c) => sum + c.estimated_monthly_cost, 0);

    res.json({
      success: true,
      data: {
        companies: billingData,
        summary: {
          total_companies: companies.length,
          total_estimated_revenue: Math.round(totalRevenue * 100) / 100,
          currency: 'USD'
        }
      }
    });
  } catch (error: any) {
    logger.error('Get all companies billing error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch billing data',
      error: error.message
    });
  }
};
