// PAYG Billing Controller - API Endpoints
import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../config/database';
import logger from '../utils/logger';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Get current month usage summary for a company
 */
export const getCurrentUsage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { companyId } = req.params;

    // Access control
    if (role !== 'super_admin' && Number(companyId) !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    // Get current month date range
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    // Get daily usage for current month
    const dailyUsage = await prisma.daily_vm_usage.findMany({
      where: {
        company_id: Number(companyId),
        usage_date: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      },
      include: {
        virtual_machines: {
          select: {
            id: true,
            name: true,
            vmid: true,
            status: true
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

    // Calculate totals
    const summary = {
      period_start: startOfMonth,
      period_end: endOfMonth,
      days_in_month: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
      days_elapsed: now.getDate(),
      total_vms: new Set(dailyUsage.map(d => d.vm_id)).size,
      total_cpu_hours: new Decimal(0),
      total_memory_gb_hours: new Decimal(0),
      total_disk_gb_hours: new Decimal(0),
      total_network_gb: new Decimal(0),
      cost_cpu: new Decimal(0),
      cost_memory: new Decimal(0),
      cost_storage: new Decimal(0),
      cost_network: new Decimal(0),
      total_cost: new Decimal(0),
      estimated_month_end_cost: new Decimal(0)
    };

    for (const usage of dailyUsage) {
      summary.total_cpu_hours = summary.total_cpu_hours.add(usage.total_cpu_hours);
      summary.total_memory_gb_hours = summary.total_memory_gb_hours.add(usage.total_memory_gb_hours);
      summary.total_disk_gb_hours = summary.total_disk_gb_hours.add(usage.total_disk_gb_hours);
      summary.total_network_gb = summary.total_network_gb.add(usage.total_network_gb || 0);
      summary.cost_cpu = summary.cost_cpu.add(usage.cost_cpu || 0);
      summary.cost_memory = summary.cost_memory.add(usage.cost_memory || 0);
      summary.cost_storage = summary.cost_storage.add(usage.cost_storage || 0);
      summary.cost_network = summary.cost_network.add(usage.cost_network || 0);
      summary.total_cost = summary.total_cost.add(usage.total_cost || 0);
    }

    // Estimate end-of-month cost (linear projection)
    if (summary.days_elapsed > 0) {
      const dailyAverage = summary.total_cost.div(summary.days_elapsed);
      summary.estimated_month_end_cost = dailyAverage.mul(summary.days_in_month);
    }

    res.json({
      success: true,
      data: summary
    });
  } catch (error: any) {
    logger.error('Get current usage error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch usage data',
      error: error.message
    });
  }
};

/**
 * Get detailed VM usage breakdown for current month
 */
export const getVMUsageBreakdown = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { companyId } = req.params;

    if (role !== 'super_admin' && Number(companyId) !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Aggregate usage by VM
    const vmUsage = await prisma.$queryRaw`
      SELECT
        dvu.vm_id,
        vm.name AS vm_name,
        vm.vmid,
        proj.name AS project_name,
        COUNT(DISTINCT dvu.usage_date) AS days_tracked,
        SUM(dvu.total_cpu_hours) AS total_cpu_hours,
        SUM(dvu.total_memory_gb_hours) AS total_memory_gb_hours,
        SUM(dvu.total_disk_gb_hours) AS total_disk_gb_hours,
        SUM(dvu.total_network_gb) AS total_network_gb,
        SUM(dvu.cost_cpu) AS cost_cpu,
        SUM(dvu.cost_memory) AS cost_memory,
        SUM(dvu.cost_storage) AS cost_storage,
        SUM(dvu.cost_network) AS cost_network,
        SUM(dvu.total_cost) AS total_cost,
        AVG(dvu.avg_cpu_cores) AS avg_cpu_cores,
        AVG(dvu.avg_memory_mb) AS avg_memory_mb,
        AVG(dvu.avg_disk_gb) AS avg_disk_gb
      FROM daily_vm_usage dvu
      JOIN virtual_machines vm ON dvu.vm_id = vm.id
      LEFT JOIN vm_projects proj ON dvu.project_id = proj.id
      WHERE dvu.company_id = ${Number(companyId)}
        AND dvu.usage_date >= ${startOfMonth}
        AND dvu.usage_date <= ${endOfMonth}
      GROUP BY dvu.vm_id, vm.name, vm.vmid, proj.name
      ORDER BY total_cost DESC
    `;

    res.json({
      success: true,
      data: vmUsage
    });
  } catch (error: any) {
    logger.error('Get VM usage breakdown error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch VM usage breakdown',
      error: error.message
    });
  }
};

/**
 * Get daily cost trend for current month
 */
export const getDailyCostTrend = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { companyId } = req.params;

    if (role !== 'super_admin' && Number(companyId) !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const dailyCosts = await prisma.$queryRaw`
      SELECT
        usage_date,
        COUNT(DISTINCT vm_id) AS active_vms,
        SUM(total_cpu_hours) AS cpu_hours,
        SUM(total_memory_gb_hours) AS memory_gb_hours,
        SUM(total_disk_gb_hours) AS disk_gb_hours,
        SUM(total_network_gb) AS network_gb,
        SUM(cost_cpu) AS cost_cpu,
        SUM(cost_memory) AS cost_memory,
        SUM(cost_storage) AS cost_storage,
        SUM(cost_network) AS cost_network,
        SUM(total_cost) AS total_cost
      FROM daily_vm_usage
      WHERE company_id = ${Number(companyId)}
        AND usage_date >= ${startOfMonth}
        AND usage_date <= ${endOfMonth}
      GROUP BY usage_date
      ORDER BY usage_date ASC
    `;

    res.json({
      success: true,
      data: dailyCosts
    });
  } catch (error: any) {
    logger.error('Get daily cost trend error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cost trend',
      error: error.message
    });
  }
};

/**
 * Get resource usage distribution (pie chart data)
 */
export const getResourceDistribution = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { companyId } = req.params;

    if (role !== 'super_admin' && Number(companyId) !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const distribution = await prisma.daily_vm_usage.aggregate({
      where: {
        company_id: Number(companyId),
        usage_date: {
          gte: startOfMonth
        }
      },
      _sum: {
        cost_cpu: true,
        cost_memory: true,
        cost_storage: true,
        cost_network: true
      }
    });

    res.json({
      success: true,
      data: {
        cpu: distribution._sum.cost_cpu || 0,
        memory: distribution._sum.cost_memory || 0,
        storage: distribution._sum.cost_storage || 0,
        network: distribution._sum.cost_network || 0
      }
    });
  } catch (error: any) {
    logger.error('Get resource distribution error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch resource distribution',
      error: error.message
    });
  }
};

/**
 * Get historical monthly costs (last 12 months)
 */
export const getMonthlyHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { companyId } = req.params;

    if (role !== 'super_admin' && Number(companyId) !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    // Get last 12 months of invoices
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const monthlyData = await prisma.invoices.findMany({
      where: {
        company_id: Number(companyId),
        auto_generated: true,
        billing_period_start: {
          gte: twelveMonthsAgo
        }
      },
      select: {
        billing_period_start: true,
        billing_period_end: true,
        total_amount: true,
        status: true,
        invoice_number: true
      },
      orderBy: {
        billing_period_start: 'asc'
      }
    });

    res.json({
      success: true,
      data: monthlyData
    });
  } catch (error: any) {
    logger.error('Get monthly history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch monthly history',
      error: error.message
    });
  }
};

/**
 * Get real-time metrics for active VMs (last 30 minutes)
 */
export const getCurrentMetrics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { companyId } = req.params;

    if (role !== 'super_admin' && Number(companyId) !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const thirtyMinutesAgo = new Date();
    thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);

    const recentMetrics = await prisma.vm_resource_metrics.findMany({
      where: {
        company_id: Number(companyId),
        collected_at: {
          gte: thirtyMinutesAgo
        }
      },
      include: {
        virtual_machines: {
          select: {
            id: true,
            name: true,
            vmid: true
          }
        }
      },
      orderBy: {
        collected_at: 'desc'
      },
      take: 100
    });

    res.json({
      success: true,
      data: recentMetrics
    });
  } catch (error: any) {
    logger.error('Get current metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch current metrics',
      error: error.message
    });
  }
};

/**
 * Get project-level cost breakdown
 */
export const getProjectCosts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { companyId } = req.params;

    if (role !== 'super_admin' && Number(companyId) !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const projectCosts = await prisma.$queryRaw`
      SELECT
        proj.id AS project_id,
        proj.name AS project_name,
        COUNT(DISTINCT dvu.vm_id) AS vm_count,
        SUM(dvu.total_cost) AS total_cost,
        SUM(dvu.cost_cpu) AS cost_cpu,
        SUM(dvu.cost_memory) AS cost_memory,
        SUM(dvu.cost_storage) AS cost_storage,
        SUM(dvu.cost_network) AS cost_network
      FROM daily_vm_usage dvu
      LEFT JOIN vm_projects proj ON dvu.project_id = proj.id
      WHERE dvu.company_id = ${Number(companyId)}
        AND dvu.usage_date >= ${startOfMonth}
      GROUP BY proj.id, proj.name
      ORDER BY total_cost DESC
    `;

    res.json({
      success: true,
      data: projectCosts
    });
  } catch (error: any) {
    logger.error('Get project costs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch project costs',
      error: error.message
    });
  }
};

/**
 * Get cost alerts and thresholds status
 */
export const getCostAlerts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { companyId } = req.params;

    if (role !== 'super_admin' && Number(companyId) !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    // Get current month total
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const currentTotal = await prisma.daily_vm_usage.aggregate({
      where: {
        company_id: Number(companyId),
        usage_date: {
          gte: startOfMonth
        }
      },
      _sum: {
        total_cost: true
      }
    });

    const currentCost = currentTotal._sum.total_cost || new Decimal(0);

    // TODO: Get company budget/threshold settings
    const monthlyBudget = new Decimal(1000); // Placeholder
    const warningThreshold = monthlyBudget.mul(0.8);
    const criticalThreshold = monthlyBudget.mul(0.95);

    const alerts = [];

    if (currentCost.greaterThanOrEqualTo(criticalThreshold)) {
      alerts.push({
        level: 'critical',
        message: `Current usage ($${currentCost.toFixed(2)}) has exceeded 95% of monthly budget ($${monthlyBudget.toFixed(2)})`,
        percentage: currentCost.div(monthlyBudget).mul(100).toFixed(1)
      });
    } else if (currentCost.greaterThanOrEqualTo(warningThreshold)) {
      alerts.push({
        level: 'warning',
        message: `Current usage ($${currentCost.toFixed(2)}) has exceeded 80% of monthly budget ($${monthlyBudget.toFixed(2)})`,
        percentage: currentCost.div(monthlyBudget).mul(100).toFixed(1)
      });
    }

    res.json({
      success: true,
      data: {
        current_cost: currentCost,
        monthly_budget: monthlyBudget,
        percentage_used: currentCost.div(monthlyBudget).mul(100),
        alerts: alerts
      }
    });
  } catch (error: any) {
    logger.error('Get cost alerts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cost alerts',
      error: error.message
    });
  }
};
