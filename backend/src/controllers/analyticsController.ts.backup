import { Request, Response } from 'express';
import prisma from '../config/database';
import logger from '../utils/logger';

/**
 * Get VM summary analytics
 * Query params: timeRange (1h, 6h, 24h, 7d, 30d)
 */
export const getVMSummary = async (req: Request, res: Response) => {
  try {
    const { timeRange = '24h' } = req.query as { timeRange?: string };
    const user = (req as any).user;

    // Calculate time range
    const now = new Date();
    let startTime = new Date();

    switch (timeRange) {
      case '1h':
        startTime.setHours(now.getHours() - 1);
        break;
      case '6h':
        startTime.setHours(now.getHours() - 6);
        break;
      case '24h':
        startTime.setHours(now.getHours() - 24);
        break;
      case '7d':
        startTime.setDate(now.getDate() - 7);
        break;
      case '30d':
        startTime.setDate(now.getDate() - 30);
        break;
      default:
        startTime.setHours(now.getHours() - 24);
    }

    // Build where clause based on user role
    const where: any = {
      collected_at: {
        gte: startTime,
      },
    };

    if (user.role !== 'super_admin') {
      where.company_id = user.company_id;
    }

    // Get VM summary statistics
    const [totalVMs, runningVMs, stoppedVMs, avgCPU, avgMemory, totalNetwork] = await Promise.all([
      prisma.virtual_machines.count({
        where: user.role === 'super_admin' ? {} : { company_id: user.company_id },
      }),
      prisma.vm_resource_metrics.groupBy({
        by: ['vm_id'],
        where: {
          ...where,
          vm_status: 'running',
        },
        _count: {
          vm_id: true,
        },
      }),
      prisma.vm_resource_metrics.groupBy({
        by: ['vm_id'],
        where: {
          ...where,
          vm_status: 'stopped',
        },
        _count: {
          vm_id: true,
        },
      }),
      prisma.vm_resource_metrics.aggregate({
        where,
        _avg: {
          cpu_usage_percent: true,
          memory_percent: true,
        },
      }),
      prisma.vm_resource_metrics.aggregate({
        where,
        _avg: {
          memory_percent: true,
        },
      }),
      prisma.vm_resource_metrics.aggregate({
        where,
        _sum: {
          network_in_bytes: true,
          network_out_bytes: true,
        },
      }),
    ]);

    // Get time series data for CPU and Memory usage
    const metrics = await prisma.vm_resource_metrics.findMany({
      where,
      select: {
        cpu_usage_percent: true,
        memory_percent: true,
        collected_at: true,
      },
      orderBy: {
        collected_at: 'asc',
      },
      take: 100, // Limit to 100 data points
    });

    return res.json({
      success: true,
      data: {
        summary: {
          total_vms: totalVMs,
          running_vms: runningVMs.length,
          stopped_vms: stoppedVMs.length,
          avg_cpu_usage: avgCPU._avg.cpu_usage_percent || 0,
          avg_memory_usage: avgMemory._avg.memory_percent || 0,
          total_network_in_gb: totalNetwork._sum.network_in_bytes
            ? Number(totalNetwork._sum.network_in_bytes) / (1024 * 1024 * 1024)
            : 0,
          total_network_out_gb: totalNetwork._sum.network_out_bytes
            ? Number(totalNetwork._sum.network_out_bytes) / (1024 * 1024 * 1024)
            : 0,
        },
        time_series: metrics.map((m) => ({
          timestamp: m.collected_at,
          cpu: Number(m.cpu_usage_percent),
          memory: Number(m.memory_percent),
        })),
        time_range: timeRange,
        period: {
          start: startTime,
          end: now,
        },
      },
    });
  } catch (error: any) {
    logger.error('Get VM summary error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch VM summary',
      error: error.message,
    });
  }
};

/**
 * Get top resource consumers
 * Query params: metric (cpu, memory, disk, network), limit
 */
export const getTopConsumers = async (req: Request, res: Response) => {
  try {
    const { metric = 'cpu', limit = '10' } = req.query as { metric?: string; limit?: string };
    const user = (req as any).user;

    const limitNum = parseInt(limit);

    // Get recent metrics (last hour)
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const where: any = {
      collected_at: {
        gte: oneHourAgo,
      },
    };

    if (user.role !== 'super_admin') {
      where.company_id = user.company_id;
    }

    // Determine order by field based on metric
    const orderByField = metric === 'cpu' ? 'cpu_usage_percent' : metric === 'memory' ? 'memory_percent' : 'disk_used_gb';
    const companyFilter = user.role !== 'super_admin' ? `AND m2.company_id = ${user.company_id}` : '';

    const latestMetrics = await prisma.$queryRaw<any[]>`
      SELECT
        m.*,
        vm.name as vm_name,
        vm.vmid,
        c.name as company_name
      FROM vm_resource_metrics m
      INNER JOIN (
        SELECT vm_id, MAX(collected_at) as max_collected
        FROM vm_resource_metrics m2
        WHERE m2.collected_at >= ${oneHourAgo}
        ${prisma.$queryRawUnsafe(companyFilter)}
        GROUP BY vm_id
      ) latest ON m.vm_id = latest.vm_id AND m.collected_at = latest.max_collected
      INNER JOIN virtual_machines vm ON m.vm_id = vm.id
      INNER JOIN companies c ON m.company_id = c.id
      ORDER BY ${prisma.$queryRawUnsafe(`m.${orderByField} DESC`)}
      LIMIT ${limitNum}
    `;

    const topConsumers = latestMetrics.map((m) => ({
      vm_id: m.vm_id,
      vm_name: m.vm_name,
      vmid: m.vmid,
      company_name: m.company_name,
      cpu_usage: Number(m.cpu_usage_percent),
      memory_usage: Number(m.memory_percent),
      memory_used_mb: m.memory_used_mb,
      memory_total_mb: m.memory_mb,
      disk_used_gb: Number(m.disk_used_gb),
      disk_total_gb: Number(m.disk_total_gb),
      network_in_mb: Number(m.network_in_bytes) / (1024 * 1024),
      network_out_mb: Number(m.network_out_bytes) / (1024 * 1024),
      status: m.vm_status,
      collected_at: m.collected_at,
    }));

    return res.json({
      success: true,
      data: {
        metric,
        limit: limitNum,
        consumers: topConsumers,
      },
    });
  } catch (error: any) {
    logger.error('Get top consumers error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch top consumers',
      error: error.message,
    });
  }
};

/**
 * Get cluster analytics
 * Params: clusterId
 * Query params: timeRange
 */
export const getClusterAnalytics = async (req: Request, res: Response) => {
  try {
    const { clusterId } = req.params;
    const { timeRange = '24h' } = req.query as { timeRange?: string };
    const user = (req as any).user;

    // Calculate time range
    const now = new Date();
    let startTime = new Date();

    switch (timeRange) {
      case '1h':
        startTime.setHours(now.getHours() - 1);
        break;
      case '6h':
        startTime.setHours(now.getHours() - 6);
        break;
      case '24h':
        startTime.setHours(now.getHours() - 24);
        break;
      case '7d':
        startTime.setDate(now.getDate() - 7);
        break;
      case '30d':
        startTime.setDate(now.getDate() - 30);
        break;
      default:
        startTime.setHours(now.getHours() - 24);
    }

    // Verify cluster access
    const cluster = await prisma.proxmox_clusters.findUnique({
      where: { id: parseInt(clusterId) },
    });

    if (!cluster) {
      return res.status(404).json({
        success: false,
        message: 'Cluster not found',
      });
    }

    // Build where clause
    const where: any = {
      cluster_id: parseInt(clusterId),
      collected_at: {
        gte: startTime,
      },
    };

    if (user.role !== 'super_admin') {
      where.company_id = user.company_id;
    }

    // Get cluster statistics
    const [vmCount, metrics, avgStats] = await Promise.all([
      prisma.virtual_machines.count({
        where: {
          cluster_id: parseInt(clusterId),
          ...(user.role !== 'super_admin' && { company_id: user.company_id }),
        },
      }),
      prisma.vm_resource_metrics.findMany({
        where,
        select: {
          cpu_usage_percent: true,
          memory_percent: true,
          disk_used_gb: true,
          network_in_bytes: true,
          network_out_bytes: true,
          collected_at: true,
        },
        orderBy: {
          collected_at: 'asc',
        },
        take: 100,
      }),
      prisma.vm_resource_metrics.aggregate({
        where,
        _avg: {
          cpu_usage_percent: true,
          memory_percent: true,
        },
        _sum: {
          disk_used_gb: true,
          network_in_bytes: true,
          network_out_bytes: true,
        },
      }),
    ]);

    return res.json({
      success: true,
      data: {
        cluster: {
          id: cluster.id,
          name: cluster.name,
          host: cluster.host,
        },
        summary: {
          total_vms: vmCount,
          avg_cpu_usage: avgStats._avg.cpu_usage_percent || 0,
          avg_memory_usage: avgStats._avg.memory_percent || 0,
          total_disk_used_gb: avgStats._sum.disk_used_gb || 0,
          total_network_in_gb: avgStats._sum.network_in_bytes
            ? Number(avgStats._sum.network_in_bytes) / (1024 * 1024 * 1024)
            : 0,
          total_network_out_gb: avgStats._sum.network_out_bytes
            ? Number(avgStats._sum.network_out_bytes) / (1024 * 1024 * 1024)
            : 0,
        },
        time_series: metrics.map((m) => ({
          timestamp: m.collected_at,
          cpu: Number(m.cpu_usage_percent),
          memory: Number(m.memory_percent),
          disk: Number(m.disk_used_gb),
          network_in_mb: Number(m.network_in_bytes) / (1024 * 1024),
          network_out_mb: Number(m.network_out_bytes) / (1024 * 1024),
        })),
        time_range: timeRange,
        period: {
          start: startTime,
          end: now,
        },
      },
    });
  } catch (error: any) {
    logger.error('Get cluster analytics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch cluster analytics',
      error: error.message,
    });
  }
};

/**
 * Get VM-specific analytics
 * Params: vmId
 * Query params: timeRange
 */
export const getVMAnalytics = async (req: Request, res: Response) => {
  try {
    const { vmId } = req.params;
    const { timeRange = '24h' } = req.query as { timeRange?: string };
    const user = (req as any).user;

    // Calculate time range
    const now = new Date();
    let startTime = new Date();

    switch (timeRange) {
      case '1h':
        startTime.setHours(now.getHours() - 1);
        break;
      case '6h':
        startTime.setHours(now.getHours() - 6);
        break;
      case '24h':
        startTime.setHours(now.getHours() - 24);
        break;
      case '7d':
        startTime.setDate(now.getDate() - 7);
        break;
      case '30d':
        startTime.setDate(now.getDate() - 30);
        break;
      default:
        startTime.setHours(now.getHours() - 24);
    }

    // Verify VM access
    const vm = await prisma.virtual_machines.findUnique({
      where: { id: parseInt(vmId) },
      include: {
        companies: {
          select: {
            id: true,
            name: true,
          },
        },
        proxmox_clusters: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!vm) {
      return res.status(404).json({
        success: false,
        message: 'VM not found',
      });
    }

    // Check access
    if (user.role !== 'super_admin' && vm.company_id !== user.company_id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Get VM metrics
    const metrics = await prisma.vm_resource_metrics.findMany({
      where: {
        vm_id: parseInt(vmId),
        collected_at: {
          gte: startTime,
        },
      },
      orderBy: {
        collected_at: 'asc',
      },
    });

    // Calculate statistics
    const stats = {
      avg_cpu: 0,
      max_cpu: 0,
      avg_memory: 0,
      max_memory: 0,
      total_disk_read_iops: 0,
      total_disk_write_iops: 0,
      total_network_in_gb: 0,
      total_network_out_gb: 0,
    };

    if (metrics.length > 0) {
      stats.avg_cpu = metrics.reduce((sum, m) => sum + Number(m.cpu_usage_percent || 0), 0) / metrics.length;
      stats.max_cpu = Math.max(...metrics.map((m) => Number(m.cpu_usage_percent || 0)));
      stats.avg_memory = metrics.reduce((sum, m) => sum + Number(m.memory_percent || 0), 0) / metrics.length;
      stats.max_memory = Math.max(...metrics.map((m) => Number(m.memory_percent || 0)));
      stats.total_disk_read_iops = metrics.reduce((sum, m) => sum + (m.disk_read_iops || 0), 0);
      stats.total_disk_write_iops = metrics.reduce((sum, m) => sum + (m.disk_write_iops || 0), 0);
      stats.total_network_in_gb = metrics.reduce((sum, m) => sum + Number(m.network_in_bytes || 0), 0) / (1024 * 1024 * 1024);
      stats.total_network_out_gb = metrics.reduce((sum, m) => sum + Number(m.network_out_bytes || 0), 0) / (1024 * 1024 * 1024);
    }

    return res.json({
      success: true,
      data: {
        vm: {
          id: vm.id,
          name: vm.name,
          vmid: vm.vmid,
          company: vm.companies,
          cluster: vm.proxmox_clusters,
        },
        statistics: stats,
        time_series: metrics.map((m) => ({
          timestamp: m.collected_at,
          cpu_usage: Number(m.cpu_usage_percent),
          memory_usage: Number(m.memory_percent),
          memory_used_mb: m.memory_used_mb,
          disk_read_iops: m.disk_read_iops,
          disk_write_iops: m.disk_write_iops,
          network_in_mb: Number(m.network_in_bytes) / (1024 * 1024),
          network_out_mb: Number(m.network_out_bytes) / (1024 * 1024),
          status: m.vm_status,
        })),
        time_range: timeRange,
        period: {
          start: startTime,
          end: now,
        },
      },
    });
  } catch (error: any) {
    logger.error('Get VM analytics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch VM analytics',
      error: error.message,
    });
  }
};
