import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
    company_id?: number;
  };
}

/**
 * IP Conflict Validator Controller
 *
 * Validates IP addresses before assignment to prevent conflicts
 * Checks database for existing assignments and provides alternatives
 */

/**
 * Validate single IP address
 * POST /api/ip-ranges/validate-ip
 */
export const validateIP = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { ip_address, ip_range_id, vm_id } = req.body;
    const user = req.user!;

    // Validate required fields
    if (!ip_address) {
      res.status(400).json({
        success: false,
        message: 'IP address is required',
      });
      return;
    }

    // Check if IP is already assigned
    const existingAssignment = await prisma.vm_ip_assignments.findFirst({
      where: {
        ip_address,
        ip_range_id: ip_range_id || undefined,
        NOT: {
          vm_id: vm_id || undefined, // Exclude current VM if editing
        },
      },
      include: {
        virtual_machines: {
          select: {
            id: true,
            name: true,
            vmid: true,
          },
        },
      },
    });

    if (existingAssignment) {
      res.status(409).json({
        success: false,
        message: 'IP address is already in use',
        conflict: {
          ip_address,
          assigned_to_vm: existingAssignment.virtual_machines?.name || 'Unknown',
          assigned_to_vmid: existingAssignment.virtual_machines?.vmid || null,
          assigned_at: existingAssignment.assigned_at,
        },
      });
      return;
    }

    // If IP range is provided, validate it's within the range
    if (ip_range_id) {
      const ipRange = await prisma.ip_ranges.findUnique({
        where: { id: ip_range_id },
      });

      if (!ipRange) {
        res.status(404).json({
          success: false,
          message: 'IP range not found',
        });
        return;
      }

      // Check if user has access to this IP range
      if (user.role !== 'super_admin' && ipRange.company_id !== user.company_id) {
        res.status(403).json({
          success: false,
          message: 'Access denied to this IP range',
        });
        return;
      }

      // Validate IP is within range
      if (!isIPInRange(ip_address, ipRange.subnet, ipRange.netmask || '')) {
        res.status(400).json({
          success: false,
          message: `IP address ${ip_address} is not within the range ${ipRange.subnet}/${ipRange.netmask}`,
        });
        return;
      }

      // Check if IP is reserved (network address, broadcast, gateway)
      const reservedIPs = getReservedIPs(ipRange.subnet, ipRange.netmask || '', ipRange.gateway);
      if (reservedIPs.includes(ip_address)) {
        res.status(400).json({
          success: false,
          message: `IP address ${ip_address} is reserved (network address, broadcast, or gateway)`,
          reserved_ips: reservedIPs,
        });
        return;
      }
    }

    // IP is available
    res.status(200).json({
      success: true,
      message: 'IP address is available',
      ip_address,
      available: true,
    });
  } catch (error: any) {
    console.error('IP validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate IP address',
      error: error.message,
    });
  }
};

/**
 * Get available IPs in a range
 * GET /api/ip-ranges/:id/available-ips
 */
export const getAvailableIPs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const user = req.user!;

    const ipRange = await prisma.ip_ranges.findUnique({
      where: { id: parseInt(id) },
    });

    if (!ipRange) {
      res.status(404).json({
        success: false,
        message: 'IP range not found',
      });
      return;
    }

    // Check permissions
    if (user.role !== 'super_admin' && ipRange.company_id !== user.company_id) {
      res.status(403).json({
        success: false,
        message: 'Access denied',
      });
      return;
    }

    // Get all assigned IPs in this range
    const assignedIPs = await prisma.vm_ip_assignments.findMany({
      where: { ip_range_id: parseInt(id) },
      select: { ip_address: true },
    });

    const assignedIPSet = new Set(assignedIPs.map((a) => a.ip_address));

    // Calculate all IPs in the range
    const allIPs = calculateIPRange(ipRange.subnet, ipRange.netmask || '');
    const reservedIPs = new Set(getReservedIPs(ipRange.subnet, ipRange.netmask || '', ipRange.gateway));

    // Filter to get available IPs
    const availableIPs = allIPs.filter(
      (ip) => !assignedIPSet.has(ip) && !reservedIPs.has(ip)
    );

    // Apply pagination
    const startIndex = parseInt(offset as string);
    const limitNum = parseInt(limit as string);
    const paginatedIPs = availableIPs.slice(startIndex, startIndex + limitNum);

    res.status(200).json({
      success: true,
      data: {
        ip_range_id: parseInt(id),
        subnet: ipRange.subnet,
        netmask: ipRange.netmask,
        total_ips: allIPs.length,
        assigned_ips: assignedIPs.length,
        available_ips: availableIPs.length,
        reserved_ips: reservedIPs.size,
        available_ips_list: paginatedIPs,
        pagination: {
          offset: startIndex,
          limit: limitNum,
          total: availableIPs.length,
        },
      },
    });
  } catch (error: any) {
    console.error('Get available IPs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get available IPs',
      error: error.message,
    });
  }
};

/**
 * Suggest next available IP
 * GET /api/ip-ranges/:id/suggest-ip
 */
export const suggestNextIP = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const ipRange = await prisma.ip_ranges.findUnique({
      where: { id: parseInt(id) },
    });

    if (!ipRange) {
      res.status(404).json({
        success: false,
        message: 'IP range not found',
      });
      return;
    }

    // Check permissions
    if (user.role !== 'super_admin' && ipRange.company_id !== user.company_id) {
      res.status(403).json({
        success: false,
        message: 'Access denied',
      });
      return;
    }

    // Get all assigned IPs in this range
    const assignedIPs = await prisma.vm_ip_assignments.findMany({
      where: { ip_range_id: parseInt(id) },
      select: { ip_address: true },
      orderBy: { ip_address: 'asc' },
    });

    const assignedIPSet = new Set(assignedIPs.map((a) => a.ip_address));

    // Calculate all IPs in the range
    const allIPs = calculateIPRange(ipRange.subnet, ipRange.netmask || '');
    const reservedIPs = new Set(getReservedIPs(ipRange.subnet, ipRange.netmask || '', ipRange.gateway));

    // Find first available IP
    const availableIP = allIPs.find((ip) => !assignedIPSet.has(ip) && !reservedIPs.has(ip));

    if (!availableIP) {
      res.status(404).json({
        success: false,
        message: 'No available IPs in this range',
        total_ips: allIPs.length,
        assigned_ips: assignedIPs.length,
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        suggested_ip: availableIP,
        ip_range_id: parseInt(id),
        subnet: ipRange.subnet,
        netmask: ipRange.netmask,
        gateway: ipRange.gateway,
      },
    });
  } catch (error: any) {
    console.error('Suggest IP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to suggest IP',
      error: error.message,
    });
  }
};

/**
 * Check if IP is within a subnet range
 */
function isIPInRange(ip: string, subnet: string, netmask: string): boolean {
  const ipNum = ipToNumber(ip);
  const subnetNum = ipToNumber(subnet);
  const netmaskNum = ipToNumber(netmask);

  const networkAddress = subnetNum & netmaskNum;
  const broadcastAddress = networkAddress | (~netmaskNum >>> 0);

  return ipNum >= networkAddress && ipNum <= broadcastAddress;
}

/**
 * Get reserved IPs (network address, broadcast, gateway)
 */
function getReservedIPs(subnet: string, netmask: string, gateway: string | null): string[] {
  const reserved: string[] = [];

  const subnetNum = ipToNumber(subnet);
  const netmaskNum = ipToNumber(netmask);

  // Network address (first IP)
  const networkAddress = subnetNum & netmaskNum;
  reserved.push(numberToIP(networkAddress));

  // Broadcast address (last IP)
  const broadcastAddress = networkAddress | (~netmaskNum >>> 0);
  reserved.push(numberToIP(broadcastAddress));

  // Gateway (if specified)
  if (gateway) {
    reserved.push(gateway);
  }

  return reserved;
}

/**
 * Calculate all IPs in a subnet range
 */
function calculateIPRange(subnet: string, netmask: string): string[] {
  const ips: string[] = [];

  const subnetNum = ipToNumber(subnet);
  const netmaskNum = ipToNumber(netmask);

  const networkAddress = subnetNum & netmaskNum;
  const broadcastAddress = networkAddress | (~netmaskNum >>> 0);

  // Skip network address and broadcast address
  for (let i = networkAddress + 1; i < broadcastAddress; i++) {
    ips.push(numberToIP(i));
  }

  return ips;
}

/**
 * Convert IP address string to number
 */
function ipToNumber(ip: string): number {
  const parts = ip.split('.').map((p) => parseInt(p));
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/**
 * Convert number to IP address string
 */
function numberToIP(num: number): string {
  return [
    (num >>> 24) & 0xff,
    (num >>> 16) & 0xff,
    (num >>> 8) & 0xff,
    num & 0xff,
  ].join('.');
}
