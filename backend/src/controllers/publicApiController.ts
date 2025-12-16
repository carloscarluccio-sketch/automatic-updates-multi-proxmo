/**
 * Public API Controller (v1)
 * RESTful endpoints for external API access
 */

import { Response } from 'express';
import { ApiAuthRequest } from '../middlewares/apiKeyAuth';
import prisma from '../config/database';
import logger from '../utils/logger';

/**
 * List VMs - GET /api/v1/vms
 */
export const listVMs = async (req: ApiAuthRequest, res: Response): Promise<void> => {
  try {
    const { company_id } = req.apiToken!;
    const { limit = 50, offset = 0, status, cluster_id } = req.query;

    const where: any = { company_id };

    if (status) {
      where.status = status;
    }

    if (cluster_id) {
      where.cluster_id = parseInt(cluster_id as string);
    }

    const [vms, total] = await Promise.all([
      prisma.virtual_machines.findMany({
        where,
        select: {
          id: true,
          vmid: true,
          name: true,
          status: true,
          cpu_cores: true,
          memory_mb: true,
          storage_gb: true,
          ip_address: true,
          created_at: true,
          proxmox_clusters: {
            select: {
              id: true,
              name: true,
              location: true
            }
          },
          vm_projects: {
            select: {
              id: true,
              name: true
            }
          }
        },
        take: Math.min(parseInt(limit as string), 100),
        skip: parseInt(offset as string),
        orderBy: { created_at: 'desc' }
      }),
      prisma.virtual_machines.count({ where })
    ]);

    res.json({
      success: true,
      data: vms,
      meta: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        has_more: total > parseInt(offset as string) + vms.length
      }
    });
  } catch (error) {
    logger.error('Public API - List VMs error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch VMs'
      }
    });
  }
};

/**
 * Get single VM - GET /api/v1/vms/:id
 */
export const getVM = async (req: ApiAuthRequest, res: Response): Promise<void> => {
  try {
    const { company_id } = req.apiToken!;
    const vmId = parseInt(req.params.id);

    const vm = await prisma.virtual_machines.findFirst({
      where: {
        id: vmId,
        company_id
      },
      select: {
        id: true,
        vmid: true,
        name: true,
        description: true,
        status: true,
        cpu_cores: true,
        memory_mb: true,
        storage_gb: true,
        ip_address: true,
        primary_ip_internal: true,
        primary_ip_external: true,
        node: true,
        created_at: true,
        updated_at: true,
        proxmox_clusters: {
          select: {
            id: true,
            name: true,
            location: true,
            host: true,
            port: true
          }
        },
        vm_projects: {
          select: {
            id: true,
            name: true,
            description: true
          }
        }
      }
    });

    if (!vm) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'VM not found'
        }
      });
      return;
    }

    res.json({
      success: true,
      data: vm
    });
  } catch (error) {
    logger.error('Public API - Get VM error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch VM'
      }
    });
  }
};

/**
 * List invoices - GET /api/v1/billing/invoices
 */
export const listInvoices = async (req: ApiAuthRequest, res: Response): Promise<void> => {
  try {
    const { company_id } = req.apiToken!;
    const { limit = 50, offset = 0, status } = req.query;

    const where: any = { company_id };

    if (status) {
      where.status = status;
    }

    const [invoices, total] = await Promise.all([
      prisma.invoices.findMany({
        where,
        select: {
          id: true,
          invoice_number: true,
          billing_period_start: true,
          billing_period_end: true,
          subtotal: true,
          tax_amount: true,
          discount_amount: true,
          total_amount: true,
          currency: true,
          status: true,
          due_date: true,
          issued_at: true,
          paid_at: true,
          pdf_generated: true,
          pdf_file_path: true
        },
        take: Math.min(parseInt(limit as string), 100),
        skip: parseInt(offset as string),
        orderBy: { issued_at: 'desc' }
      }),
      prisma.invoices.count({ where })
    ]);

    res.json({
      success: true,
      data: invoices,
      meta: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        has_more: total > parseInt(offset as string) + invoices.length
      }
    });
  } catch (error) {
    logger.error('Public API - List invoices error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch invoices'
      }
    });
  }
};

/**
 * Get billing estimate - GET /api/v1/billing/estimate
 */
export const getBillingEstimate = async (req: ApiAuthRequest, res: Response): Promise<void> => {
  try {
    const { company_id } = req.apiToken!;

    // Get company's current billing info
    const company = await prisma.companies.findUnique({
      where: { id: company_id },
      select: {
        id: true,
        name: true,
        company_billing: {
          select: {
            current_pricing_plan_id: true,
            next_invoice_date: true
          }
        }
      }
    });

    if (!company) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Company not found'
        }
      });
      return;
    }

    // Get all VMs for the company
    const vms = await prisma.virtual_machines.findMany({
      where: {
        company_id,
        deleted_at: null
      },
      select: {
        id: true,
        name: true,
        cpu_cores: true,
        memory_mb: true,
        storage_gb: true,
        status: true
      }
    });

    // Get pricing plan (company_billing is one-to-one relation)
    const pricingPlanId = company.company_billing?.current_pricing_plan_id;
    const pricingPlan = pricingPlanId
      ? await prisma.pricing_plans.findUnique({ where: { id: pricingPlanId } })
      : await prisma.pricing_plans.findFirst({ where: { is_default: true } });

    if (!pricingPlan) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'No pricing plan configured'
        }
      });
      return;
    }

    // Calculate estimate
    let totalBasePrice = 0;
    let totalOverages = 0;

    const vmCosts = vms.map((vm) => {
      const memoryGb = Math.round(((vm.memory_mb ?? 0) / 1024) * 100) / 100;

      const cpuOverage = Math.max(0, (vm.cpu_cores ?? 0) - (pricingPlan.included_cpu_cores ?? 0));
      const memoryOverage = Math.max(0, memoryGb - (pricingPlan.included_memory_gb ?? 0));
      const storageOverage = Math.max(0, (vm.storage_gb ?? 0) - (pricingPlan.included_storage_gb ?? 0));

      const cpuOverageCost = cpuOverage * parseFloat(pricingPlan.overage_cpu_core_price?.toString() ?? '0');
      const memoryOverageCost = memoryOverage * parseFloat(pricingPlan.overage_memory_gb_price?.toString() ?? '0');
      const storageOverageCost = storageOverage * parseFloat(pricingPlan.overage_storage_gb_price?.toString() ?? '0');

      const basePrice = parseFloat(pricingPlan.base_price?.toString() ?? '0');
      const vmTotal = basePrice + cpuOverageCost + memoryOverageCost + storageOverageCost;

      totalBasePrice += basePrice;
      totalOverages += cpuOverageCost + memoryOverageCost + storageOverageCost;

      return {
        vm_id: vm.id,
        vm_name: vm.name,
        base_price: basePrice,
        cpu_overage_cost: cpuOverageCost,
        memory_overage_cost: memoryOverageCost,
        storage_overage_cost: storageOverageCost,
        total_cost: vmTotal
      };
    });

    res.json({
      success: true,
      data: {
        company_name: company.name,
        pricing_plan: pricingPlan.name,
        billing_cycle: pricingPlan.billing_cycle,
        next_invoice_date: company.company_billing?.next_invoice_date,
        vm_count: vms.length,
        total_base_price: totalBasePrice,
        total_overages: totalOverages,
        estimated_total: totalBasePrice + totalOverages,
        currency: 'USD',
        vm_breakdown: vmCosts
      }
    });
  } catch (error) {
    logger.error('Public API - Get billing estimate error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to calculate billing estimate'
      }
    });
  }
};

/**
 * List clusters - GET /api/v1/clusters
 */
export const listClusters = async (req: ApiAuthRequest, res: Response): Promise<void> => {
  try {
    const { company_id } = req.apiToken!;

    // Get clusters assigned to this company
    const companyClusters = await prisma.company_clusters.findMany({
      where: { company_id },
      select: {
        proxmox_clusters: {
          select: {
            id: true,
            name: true,
            location: true,
            host: true,
            port: true
          }
        }
      }
    });

    const clusters = companyClusters.map((cc) => cc.proxmox_clusters);

    res.json({
      success: true,
      data: clusters,
      meta: {
        total: clusters.length
      }
    });
  } catch (error) {
    logger.error('Public API - List clusters error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch clusters'
      }
    });
  }
};

/**
 * Get API usage statistics - GET /api/v1/usage
 */
export const getApiUsage = async (req: ApiAuthRequest, res: Response): Promise<void> => {
  try {
    const tokenId = req.apiToken!.id;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [totalCalls, recentCalls, endpointStats] = await Promise.all([
      prisma.api_token_usage_logs.count({
        where: { token_id: tokenId }
      }),
      prisma.api_token_usage_logs.count({
        where: {
          token_id: tokenId,
          created_at: { gte: thirtyDaysAgo }
        }
      }),
      prisma.$queryRaw`
        SELECT
          endpoint,
          COUNT(*) as call_count,
          AVG(response_time_ms) as avg_response_time
        FROM api_token_usage_logs
        WHERE token_id = ${tokenId}
          AND created_at >= ${thirtyDaysAgo}
        GROUP BY endpoint
        ORDER BY call_count DESC
        LIMIT 10
      `
    ]);

    res.json({
      success: true,
      data: {
        total_calls: totalCalls,
        calls_last_30_days: recentCalls,
        endpoint_stats: endpointStats
      }
    });
  } catch (error) {
    logger.error('Public API - Get usage error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch usage statistics'
      }
    });
  }
};
