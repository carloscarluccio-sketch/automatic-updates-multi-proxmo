// Daily Usage Aggregation Service
// Aggregates granular metrics into daily usage records and calculates costs

import prisma from '../config/database';
import logger from '../utils/logger';
import { Decimal } from '@prisma/client/runtime/library';


/**
 * Get pricing tier for a resource type
 */
async function getPricingTier(
  companyId: number,
  projectId: number | null,
  tierType: 'cpu_core' | 'memory_gb' | 'storage_gb' | 'bandwidth_gb'
): Promise<{ id: number; unit_price: Decimal } | null> {
  try {
    // Try to find company-specific or project-specific pricing
    const tier = await prisma.pricing_tiers.findFirst({
      where: {
        tier_type: tierType,
        active: true,
        OR: [
          { company_id: companyId, project_id: projectId },
          { company_id: companyId, project_id: null },
          { company_id: null, is_default: true }
        ]
      },
      orderBy: [
        { project_id: 'desc' },  // Project-specific first
        { company_id: 'desc' },  // Then company-specific
        { is_default: 'desc' },  // Then default
        { priority: 'desc' }
      ],
      select: {
        id: true,
        unit_price: true
      }
    });

    return tier;
  } catch (error: any) {
    logger.error(`Error fetching pricing tier for ${tierType}:`, error);
    return null;
  }
}

/**
 * Calculate costs for daily usage
 */
async function calculateCosts(
  companyId: number,
  projectId: number | null,
  cpuHours: number,
  memoryGbHours: number,
  diskGbHours: number,
  networkGb: number
): Promise<{
  costCpu: Decimal;
  costMemory: Decimal;
  costStorage: Decimal;
  costNetwork: Decimal;
  totalCost: Decimal;
  pricingTierId: number | null;
}> {
  // Get pricing tiers
  const cpuTier = await getPricingTier(companyId, projectId, 'cpu_core');
  const memoryTier = await getPricingTier(companyId, projectId, 'memory_gb');
  const storageTier = await getPricingTier(companyId, projectId, 'storage_gb');
  const networkTier = await getPricingTier(companyId, projectId, 'bandwidth_gb');

  // Calculate costs
  const costCpu = cpuTier
    ? new Decimal(cpuHours).mul(cpuTier.unit_price)
    : new Decimal(0);

  const costMemory = memoryTier
    ? new Decimal(memoryGbHours).mul(memoryTier.unit_price)
    : new Decimal(0);

  const costStorage = storageTier
    ? new Decimal(diskGbHours).mul(storageTier.unit_price)
    : new Decimal(0);

  const costNetwork = networkTier
    ? new Decimal(networkGb).mul(networkTier.unit_price)
    : new Decimal(0);

  const totalCost = costCpu.add(costMemory).add(costStorage).add(costNetwork);

  return {
    costCpu,
    costMemory,
    costStorage,
    costNetwork,
    totalCost,
    pricingTierId: cpuTier?.id || null  // Reference one of the tiers
  };
}

/**
 * Aggregate metrics for a single VM for a single day
 */
async function aggregateVMDay(
  vmId: number,
  usageDate: Date
): Promise<void> {
  try {
    // Get VM details
    const vm = await prisma.virtual_machines.findUnique({
      where: { id: vmId },
      select: {
        id: true,
        company_id: true,
        cluster_id: true,
        project_id: true,
        name: true
      }
    });

    if (!vm) {
      logger.warn(`VM ${vmId} not found`);
      return;
    }

    // Define date range for the day
    const startOfDay = new Date(usageDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(usageDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all metrics for this VM on this day
    const metrics = await prisma.vm_resource_metrics.findMany({
      where: {
        vm_id: vmId,
        collected_at: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      orderBy: {
        collected_at: 'asc'
      }
    });

    if (metrics.length === 0) {
      logger.debug(`No metrics found for VM ${vmId} on ${usageDate.toISOString().split('T')[0]}`);
      return;
    }

    // Calculate averages
    const avgCpuCores = metrics.reduce((sum, m) => sum + m.cpu_cores, 0) / metrics.length;
    const avgCpuUsage = metrics.reduce((sum, m) => sum + Number(m.cpu_usage_percent || 0), 0) / metrics.length;
    const avgMemoryMb = metrics.reduce((sum, m) => sum + m.memory_mb, 0) / metrics.length;
    const avgMemoryUsage = metrics.reduce((sum, m) => sum + Number(m.memory_percent || 0), 0) / metrics.length;
    const avgDiskGb = metrics.reduce((sum, m) => sum + Number(m.disk_total_gb), 0) / metrics.length;

    // Count running vs stopped hours
    const runningMetrics = metrics.filter(m => m.vm_status === 'running');
    const stoppedMetrics = metrics.filter(m => m.vm_status === 'stopped');

    // Assuming metrics collected every 5 minutes (12 per hour)
    const metricsPerHour = 12;
    const hoursRunning = runningMetrics.length / metricsPerHour;
    const hoursStopped = stoppedMetrics.length / metricsPerHour;

    // Calculate resource-hours (only for running time)
    const totalCpuHours = avgCpuCores * hoursRunning;
    const totalMemoryGbHours = (avgMemoryMb / 1024) * hoursRunning;
    const totalDiskGbHours = avgDiskGb * 24; // Storage billed 24/7

    // Calculate network usage (bytes to GB)
    const firstMetric = metrics[0];
    const lastMetric = metrics[metrics.length - 1];
    const networkInGb = (Number(lastMetric.network_in_bytes) - Number(firstMetric.network_in_bytes)) / (1024 * 1024 * 1024);
    const networkOutGb = (Number(lastMetric.network_out_bytes) - Number(firstMetric.network_out_bytes)) / (1024 * 1024 * 1024);
    const totalNetworkGb = Math.max(0, networkInGb + networkOutGb);

    // Calculate costs
    const costs = await calculateCosts(
      vm.company_id,
      vm.project_id,
      totalCpuHours,
      totalMemoryGbHours,
      totalDiskGbHours,
      totalNetworkGb
    );

    // Upsert daily usage record
    await prisma.daily_vm_usage.upsert({
      where: {
        vm_id_usage_date: {
          vm_id: vmId,
          usage_date: startOfDay
        }
      },
      create: {
        vm_id: vmId,
        company_id: vm.company_id,
        cluster_id: vm.cluster_id,
        project_id: vm.project_id,
        usage_date: startOfDay,
        avg_cpu_cores: new Decimal(avgCpuCores.toFixed(2)),
        avg_cpu_usage_percent: new Decimal(avgCpuUsage.toFixed(2)),
        avg_memory_mb: new Decimal(avgMemoryMb.toFixed(2)),
        avg_memory_usage_percent: new Decimal(avgMemoryUsage.toFixed(2)),
        avg_disk_gb: new Decimal(avgDiskGb.toFixed(2)),
        total_cpu_hours: new Decimal(totalCpuHours.toFixed(4)),
        total_memory_gb_hours: new Decimal(totalMemoryGbHours.toFixed(4)),
        total_disk_gb_hours: new Decimal(totalDiskGbHours.toFixed(4)),
        total_network_gb: new Decimal(totalNetworkGb.toFixed(4)),
        hours_running: new Decimal(hoursRunning.toFixed(4)),
        hours_stopped: new Decimal(hoursStopped.toFixed(4)),
        cost_cpu: costs.costCpu,
        cost_memory: costs.costMemory,
        cost_storage: costs.costStorage,
        cost_network: costs.costNetwork,
        total_cost: costs.totalCost,
        pricing_tier_id: costs.pricingTierId,
        metrics_collected: metrics.length
      },
      update: {
        avg_cpu_cores: new Decimal(avgCpuCores.toFixed(2)),
        avg_cpu_usage_percent: new Decimal(avgCpuUsage.toFixed(2)),
        avg_memory_mb: new Decimal(avgMemoryMb.toFixed(2)),
        avg_memory_usage_percent: new Decimal(avgMemoryUsage.toFixed(2)),
        avg_disk_gb: new Decimal(avgDiskGb.toFixed(2)),
        total_cpu_hours: new Decimal(totalCpuHours.toFixed(4)),
        total_memory_gb_hours: new Decimal(totalMemoryGbHours.toFixed(4)),
        total_disk_gb_hours: new Decimal(totalDiskGbHours.toFixed(4)),
        total_network_gb: new Decimal(totalNetworkGb.toFixed(4)),
        hours_running: new Decimal(hoursRunning.toFixed(4)),
        hours_stopped: new Decimal(hoursStopped.toFixed(4)),
        cost_cpu: costs.costCpu,
        cost_memory: costs.costMemory,
        cost_storage: costs.costStorage,
        cost_network: costs.costNetwork,
        total_cost: costs.totalCost,
        pricing_tier_id: costs.pricingTierId,
        metrics_collected: metrics.length,
        updated_at: new Date()
      }
    });

    logger.debug(`Aggregated usage for VM ${vmId} (${vm.name}) on ${usageDate.toISOString().split('T')[0]}: ${metrics.length} metrics, $${costs.totalCost.toFixed(4)}`);
  } catch (error: any) {
    logger.error(`Error aggregating VM ${vmId} for date ${usageDate.toISOString()}:`, error);
  }
}

/**
 * Aggregate usage for all VMs for a specific date
 */
export async function aggregateDailyUsage(targetDate?: Date): Promise<void> {
  const startTime = Date.now();

  // Default to yesterday (allow time for all metrics to be collected)
  const usageDate = targetDate || new Date();
  if (!targetDate) {
    usageDate.setDate(usageDate.getDate() - 1);
  }
  usageDate.setHours(0, 0, 0, 0);

  logger.info(`========== Starting daily usage aggregation for ${usageDate.toISOString().split('T')[0]} ==========`);

  try {
    // Get all VMs that had metrics on this day
    const dateStart = new Date(usageDate);
    const dateEnd = new Date(usageDate);
    dateEnd.setHours(23, 59, 59, 999);

    const vmsWithMetrics = await prisma.vm_resource_metrics.groupBy({
      by: ['vm_id'],
      where: {
        collected_at: {
          gte: dateStart,
          lte: dateEnd
        }
      }
    });

    logger.info(`Found ${vmsWithMetrics.length} VMs with metrics for ${usageDate.toISOString().split('T')[0]}`);

    // Aggregate each VM
    for (const { vm_id } of vmsWithMetrics) {
      await aggregateVMDay(vm_id, usageDate);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`========== Daily aggregation completed in ${duration}s ==========`);

    // Get aggregation statistics
    const aggregatedCount = await prisma.daily_vm_usage.count({
      where: {
        usage_date: dateStart
      }
    });

    const totalCost = await prisma.daily_vm_usage.aggregate({
      where: {
        usage_date: dateStart
      },
      _sum: {
        total_cost: true
      }
    });

    logger.info(`Aggregated ${aggregatedCount} VM-days with total cost: $${totalCost._sum.total_cost?.toFixed(2) || '0.00'}`);

  } catch (error: any) {
    logger.error('Error in daily usage aggregation:', error);
    throw error;
  }
}

/**
 * Backfill aggregations for a date range
 */
export async function backfillAggregations(startDate: Date, endDate: Date): Promise<void> {
  logger.info(`Starting backfill from ${startDate.toISOString()} to ${endDate.toISOString()}`);

  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    await aggregateDailyUsage(currentDate);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  logger.info('Backfill completed');
}

export default {
  aggregateDailyUsage,
  backfillAggregations
};
