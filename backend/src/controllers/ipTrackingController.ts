/**
 * IP Assignment Tracking & Monitoring Controller
 * Phase 1.4: Real-time IP tracking, analytics, and monitoring
 */

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: {
    id: number;
    role: string;
    company_id: number | null;
  };
}

/**
 * Get IP utilization statistics per IP range
 * GET /api/ip-tracking/utilization
 */
export const getIPUtilization = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { cluster_id } = req.query;

    // Build filter for IP ranges
    const rangeWhere: any = {};
    if (user.role !== 'super_admin') {
      rangeWhere.OR = [
        { company_id: user.company_id },
        { is_shared: true },
      ];
    }
    if (cluster_id) {
      rangeWhere.cluster_id = Number(cluster_id);
    }

    // Get all IP ranges with assignment counts
    const ipRanges = await prisma.ip_ranges.findMany({
      where: rangeWhere,
      include: {
        vm_ip_assignments: {
          select: {
            id: true,
            ip_address: true,
            ip_type: true,
          },
        },
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

    // Calculate utilization for each range
    const utilization = ipRanges.map((range) => {
      const totalIPs = calculateTotalIPs(range.subnet);
      const usedIPs = range.vm_ip_assignments.length;
      const availableIPs = totalIPs - usedIPs - 3; // Subtract network, broadcast, gateway
      const utilizationPercent = totalIPs > 0 ? Math.round((usedIPs / totalIPs) * 100) : 0;

      return {
        id: range.id,
        subnet: range.subnet,
        description: range.description,
        vlan_id: range.vlan_id,
        company: range.companies,
        cluster: range.proxmox_clusters,
        total_ips: totalIPs,
        used_ips: usedIPs,
        available_ips: Math.max(0, availableIPs),
        utilization_percent: utilizationPercent,
        status: getUtilizationStatus(utilizationPercent),
        ip_type_breakdown: {
          internal: range.vm_ip_assignments.filter((a) => a.ip_type === 'internal').length,
          external: range.vm_ip_assignments.filter((a) => a.ip_type === 'external').length,
        },
      };
    });

    res.status(200).json({
      success: true,
      data: {
        ranges: utilization,
        summary: {
          total_ranges: utilization.length,
          total_ips: utilization.reduce((sum, r) => sum + r.total_ips, 0),
          total_used: utilization.reduce((sum, r) => sum + r.used_ips, 0),
          total_available: utilization.reduce((sum, r) => sum + r.available_ips, 0),
          average_utilization: Math.round(
            utilization.reduce((sum, r) => sum + r.utilization_percent, 0) / utilization.length || 0
          ),
        },
      },
    });
  } catch (error: any) {
    console.error('Get IP utilization error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get IP utilization: ' + error.message,
    });
  }
};

/**
 * Get IP assignment timeline/history
 * GET /api/ip-tracking/timeline
 */
export const getIPTimeline = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { days = 30, ip_range_id, vm_id } = req.query;

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Number(days));

    // Build filter
    const assignmentWhere: any = {
      assigned_at: {
        gte: startDate,
      },
    };

    if (user.role !== 'super_admin') {
      assignmentWhere.virtual_machines = {
        company_id: user.company_id,
      };
    }

    if (ip_range_id) {
      assignmentWhere.ip_range_id = Number(ip_range_id);
    }

    if (vm_id) {
      assignmentWhere.vm_id = Number(vm_id);
    }

    // Get assignments
    const assignments = await prisma.vm_ip_assignments.findMany({
      where: assignmentWhere,
      include: {
        virtual_machines: {
          select: {
            id: true,
            name: true,
            vmid: true,
          },
        },
        ip_ranges: {
          select: {
            id: true,
            subnet: true,
            description: true,
          },
        },
      },
      orderBy: {
        assigned_at: 'desc',
      },
    });

    // Group by date
    const timeline = groupByDate(assignments);

    res.status(200).json({
      success: true,
      data: {
        timeline,
        summary: {
          total_assignments: assignments.length,
          date_range: {
            start: startDate.toISOString(),
            end: new Date().toISOString(),
          },
          unique_vms: new Set(assignments.map((a) => a.vm_id)).size,
          unique_ranges: new Set(assignments.map((a) => a.ip_range_id)).size,
        },
      },
    });
  } catch (error: any) {
    console.error('Get IP timeline error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get IP timeline: ' + error.message,
    });
  }
};

/**
 * Get IP conflicts and warnings
 * GET /api/ip-tracking/conflicts
 */
export const getIPConflicts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // Build filter
    const assignmentWhere: any = {};
    if (user.role !== 'super_admin') {
      assignmentWhere.virtual_machines = {
        company_id: user.company_id,
      };
    }

    // Get all IP assignments
    const assignments = await prisma.vm_ip_assignments.findMany({
      where: assignmentWhere,
      include: {
        virtual_machines: {
          select: {
            id: true,
            name: true,
            vmid: true,
            status: true,
          },
        },
        ip_ranges: {
          select: {
            id: true,
            subnet: true,
            gateway: true,
          },
        },
      },
    });

    // Detect conflicts
    const conflicts: any[] = [];
    const ipMap = new Map<string, any[]>();

    // Group by IP address
    assignments.forEach((assignment) => {
      const ip = assignment.ip_address;
      if (!ipMap.has(ip)) {
        ipMap.set(ip, []);
      }
      ipMap.get(ip)!.push(assignment);
    });

    // Find duplicate IPs
    ipMap.forEach((assignmentList, ip) => {
      if (assignmentList.length > 1) {
        conflicts.push({
          type: 'duplicate_ip',
          severity: 'critical',
          ip_address: ip,
          affected_vms: assignmentList.map((a) => ({
            id: a.virtual_machines.id,
            name: a.virtual_machines.name,
            vmid: a.virtual_machines.vmid,
            status: a.virtual_machines.status,
          })),
          message: `IP ${ip} is assigned to ${assignmentList.length} VMs`,
        });
      }
    });

    // Check for reserved IPs
    assignments.forEach((assignment) => {
      const { ip_address, ip_ranges } = assignment;
      const isReserved = checkReservedIP(ip_address, ip_ranges.subnet, ip_ranges.gateway || '');

      if (isReserved) {
        conflicts.push({
          type: 'reserved_ip',
          severity: 'warning',
          ip_address,
          vm: {
            id: assignment.virtual_machines.id,
            name: assignment.virtual_machines.name,
            vmid: assignment.virtual_machines.vmid,
          },
          message: `IP ${ip_address} is a reserved address (network/broadcast/gateway)`,
        });
      }
    });

    // Check for out-of-range IPs
    assignments.forEach((assignment) => {
      const { ip_address, ip_ranges } = assignment;
      const inRange = isIPInSubnet(ip_address, ip_ranges.subnet);

      if (!inRange) {
        conflicts.push({
          type: 'out_of_range',
          severity: 'error',
          ip_address,
          subnet: ip_ranges.subnet,
          vm: {
            id: assignment.virtual_machines.id,
            name: assignment.virtual_machines.name,
            vmid: assignment.virtual_machines.vmid,
          },
          message: `IP ${ip_address} is outside subnet ${ip_ranges.subnet}`,
        });
      }
    });

    res.status(200).json({
      success: true,
      data: {
        conflicts,
        summary: {
          total_conflicts: conflicts.length,
          by_severity: {
            critical: conflicts.filter((c) => c.severity === 'critical').length,
            error: conflicts.filter((c) => c.severity === 'error').length,
            warning: conflicts.filter((c) => c.severity === 'warning').length,
          },
          by_type: {
            duplicate_ip: conflicts.filter((c) => c.type === 'duplicate_ip').length,
            reserved_ip: conflicts.filter((c) => c.type === 'reserved_ip').length,
            out_of_range: conflicts.filter((c) => c.type === 'out_of_range').length,
          },
        },
      },
    });
  } catch (error: any) {
    console.error('Get IP conflicts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get IP conflicts: ' + error.message,
    });
  }
};

/**
 * Get IP assignment analytics
 * GET /api/ip-tracking/analytics
 */
export const getIPAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // Build filter
    const assignmentWhere: any = {};
    if (user.role !== 'super_admin') {
      assignmentWhere.virtual_machines = {
        company_id: user.company_id,
      };
    }

    // Get assignments with related data
    const assignments = await prisma.vm_ip_assignments.findMany({
      where: assignmentWhere,
      include: {
        virtual_machines: {
          include: {
            companies: {
              select: { id: true, name: true },
            },
            proxmox_clusters: {
              select: { id: true, name: true },
            },
          },
        },
        ip_ranges: {
          select: {
            id: true,
            subnet: true,
            vlan_id: true,
          },
        },
      },
    });

    // Calculate analytics
    const analytics = {
      total_assignments: assignments.length,
      by_ip_type: {
        internal: assignments.filter((a) => a.ip_type === 'internal').length,
        external: assignments.filter((a) => a.ip_type === 'external').length,
      },
      by_company: calculateGroupedCount(
        assignments,
        (a) => a.virtual_machines.companies?.name || 'Unknown'
      ),
      by_cluster: calculateGroupedCount(
        assignments,
        (a) => a.virtual_machines.proxmox_clusters?.name || 'Unknown'
      ),
      by_vlan: calculateGroupedCount(assignments, (a) => String(a.ip_ranges.vlan_id || 'None')),
      by_interface: calculateGroupedCount(
        assignments,
        (a) => a.interface_name || 'Unknown'
      ),
      primary_ips: assignments.filter((a) => a.is_primary).length,
      recent_assignments: {
        last_24h: assignments.filter(
          (a) =>
            a.assigned_at &&
            new Date(a.assigned_at).getTime() > Date.now() - 24 * 60 * 60 * 1000
        ).length,
        last_7d: assignments.filter(
          (a) =>
            a.assigned_at &&
            new Date(a.assigned_at).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
        ).length,
        last_30d: assignments.filter(
          (a) =>
            a.assigned_at &&
            new Date(a.assigned_at).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000
        ).length,
      },
    };

    res.status(200).json({
      success: true,
      data: analytics,
    });
  } catch (error: any) {
    console.error('Get IP analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get IP analytics: ' + error.message,
    });
  }
};

/**
 * Export IP assignments report
 * GET /api/ip-tracking/export
 */
export const exportIPReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { format = 'json', ip_range_id } = req.query;

    // Build filter
    const assignmentWhere: any = {};
    if (user.role !== 'super_admin') {
      assignmentWhere.virtual_machines = {
        company_id: user.company_id,
      };
    }
    if (ip_range_id) {
      assignmentWhere.ip_range_id = Number(ip_range_id);
    }

    // Get assignments
    const assignments = await prisma.vm_ip_assignments.findMany({
      where: assignmentWhere,
      include: {
        virtual_machines: true,
        ip_ranges: true,
      },
      orderBy: {
        assigned_at: 'desc',
      },
    });

    // Format data
    const reportData = assignments.map((a: any) => ({
      vm_name: a.virtual_machines?.name || 'Unknown',
      vmid: a.virtual_machines?.vmid || 0,
      ip_address: a.ip_address,
      ip_type: a.ip_type,
      subnet: a.ip_ranges?.subnet || '',
      gateway: a.ip_ranges?.gateway || '',
      vlan: a.ip_ranges?.vlan_id || null,
      interface: a.interface_name,
      is_primary: a.is_primary,
      mac_address: a.mac_address,
      company: a.virtual_machines?.company_id || null,
      cluster: a.virtual_machines?.cluster_id || null,
      node: a.virtual_machines?.node || '',
      vm_status: a.virtual_machines?.status || '',
      assigned_at: a.assigned_at,
      notes: a.notes,
    }));

    if (format === 'csv') {
      // Generate CSV
      const csv = generateCSV(reportData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="ip-assignments.csv"');
      res.status(200).send(csv);
    } else {
      // Return JSON
      res.status(200).json({
        success: true,
        data: {
          assignments: reportData,
          generated_at: new Date().toISOString(),
          total_records: reportData.length,
        },
      });
    }
  } catch (error: any) {
    console.error('Export IP report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export IP report: ' + error.message,
    });
  }
};

// ========== Helper Functions ==========

function calculateTotalIPs(subnet: string): number {
  const [, cidr] = subnet.split('/');
  const cidrNum = parseInt(cidr);
  return Math.pow(2, 32 - cidrNum);
}

function getUtilizationStatus(percent: number): string {
  if (percent >= 90) return 'critical';
  if (percent >= 75) return 'warning';
  if (percent >= 50) return 'moderate';
  return 'healthy';
}

function groupByDate(assignments: any[]): any[] {
  const grouped = new Map<string, any[]>();

  assignments.forEach((assignment) => {
    const date = new Date(assignment.assigned_at).toISOString().split('T')[0];
    if (!grouped.has(date)) {
      grouped.set(date, []);
    }
    grouped.get(date)!.push(assignment);
  });

  return Array.from(grouped.entries()).map(([date, items]) => ({
    date,
    count: items.length,
    assignments: items,
  }));
}

function checkReservedIP(ip: string, subnet: string, gateway: string): boolean {
  const [network, cidr] = subnet.split('/');
  const networkNum = ipToNumber(network);
  const ipNum = ipToNumber(ip);
  const cidrNum = parseInt(cidr);
  const totalIPs = Math.pow(2, 32 - cidrNum);

  // Network address
  if (ipNum === networkNum) return true;

  // Broadcast address
  if (ipNum === networkNum + totalIPs - 1) return true;

  // Gateway
  if (gateway && ip === gateway) return true;

  return false;
}

function isIPInSubnet(ip: string, subnet: string): boolean {
  const [network, cidr] = subnet.split('/');
  const networkNum = ipToNumber(network);
  const ipNum = ipToNumber(ip);
  const cidrNum = parseInt(cidr);
  const mask = (0xffffffff << (32 - cidrNum)) >>> 0;

  return (ipNum & mask) === (networkNum & mask);
}

function ipToNumber(ip: string): number {
  const parts = ip.split('.').map((p) => parseInt(p));
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function calculateGroupedCount(items: any[], keyFn: (item: any) => string): any {
  const grouped = new Map<string, number>();

  items.forEach((item) => {
    const key = keyFn(item);
    grouped.set(key, (grouped.get(key) || 0) + 1);
  });

  return Object.fromEntries(grouped);
}

function generateCSV(data: any[]): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const rows = data.map((row) => headers.map((h) => JSON.stringify(row[h] ?? '')).join(','));

  return [headers.join(','), ...rows].join('\n');
}
