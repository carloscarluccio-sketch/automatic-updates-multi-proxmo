import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Extend Request type to include user from auth middleware
interface AuthRequest extends Request {
  user?: {
    id: number;
    role: string;
    company_id: number | null;
  };
}

interface BatchAssignmentRequest {
  ip_range_id: number;
  vm_ids: number[];
  start_ip?: string;
  auto_assign?: boolean;
}

interface BatchAssignmentResult {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  details: Array<{
    vm_id: number;
    vm_name: string;
    ip_address?: string;
    status: 'success' | 'failed' | 'skipped';
    message: string;
  }>;
}

// Helper function: Convert IP to number
function ipToNumber(ip: string): number {
  const parts = ip.split('.').map((p) => parseInt(p));
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

// Helper function: Convert number to IP
function numberToIP(num: number): string {
  return [
    (num >>> 24) & 0xff,
    (num >>> 16) & 0xff,
    (num >>> 8) & 0xff,
    num & 0xff,
  ].join('.');
}

// Helper function: Get reserved IPs
function getReservedIPs(subnet: string, netmask: string, gateway: string | null): string[] {
  const subnetNum = ipToNumber(subnet);
  const netmaskNum = ipToNumber(netmask);

  const networkAddress = subnetNum & netmaskNum;
  const broadcastAddress = networkAddress | (~netmaskNum >>> 0);

  const reserved = [
    numberToIP(networkAddress),  // Network address
    numberToIP(broadcastAddress), // Broadcast address
  ];

  if (gateway) {
    reserved.push(gateway);
  }

  return reserved;
}

// Helper function: Calculate all IPs in range
function calculateIPRange(subnet: string, netmask: string): string[] {
  const subnetNum = ipToNumber(subnet);
  const netmaskNum = ipToNumber(netmask);

  const networkAddress = subnetNum & netmaskNum;
  const broadcastAddress = networkAddress | (~netmaskNum >>> 0);

  const ips: string[] = [];
  for (let i = networkAddress + 1; i < broadcastAddress; i++) {
    ips.push(numberToIP(i));
  }

  return ips;
}

// Helper function: Get next available IPs
async function getNextAvailableIPs(
  ipRangeId: number,
  count: number,
  startIP?: string
): Promise<string[]> {
  // Get IP range details
  const ipRange = await prisma.ip_ranges.findUnique({
    where: { id: ipRangeId },
  });

  if (!ipRange) {
    throw new Error('IP range not found');
  }

  // Get all assigned IPs
  const assignments = await prisma.vm_ip_assignments.findMany({
    where: { ip_range_id: ipRangeId },
    select: { ip_address: true },
  });

  const assignedIPSet = new Set(assignments.map((a) => a.ip_address));

  // Calculate all possible IPs in range
  const allIPs = calculateIPRange(ipRange.subnet, ipRange.netmask || '255.255.255.0');

  // Get reserved IPs
  const reservedIPs = new Set(
    getReservedIPs(ipRange.subnet, ipRange.netmask || '255.255.255.0', ipRange.gateway)
  );

  // Filter available IPs
  let availableIPs = allIPs.filter(
    (ip) => !assignedIPSet.has(ip) && !reservedIPs.has(ip)
  );

  // If start IP specified, filter from that point
  if (startIP) {
    const startNum = ipToNumber(startIP);
    availableIPs = availableIPs.filter((ip) => ipToNumber(ip) >= startNum);
  }

  // Return requested count
  return availableIPs.slice(0, count);
}

/**
 * Batch assign IPs to multiple VMs
 * POST /api/batch-ip/assign
 */
export const batchAssignIPs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { ip_range_id, vm_ids, start_ip, auto_assign = true }: BatchAssignmentRequest = req.body;

    // Validate input
    if (!ip_range_id || !vm_ids || !Array.isArray(vm_ids) || vm_ids.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Invalid request. ip_range_id and vm_ids array are required.',
      });
      return;
    }

    if (vm_ids.length > 100) {
      res.status(400).json({
        success: false,
        message: 'Cannot assign more than 100 IPs at once.',
      });
      return;
    }

    // Verify IP range exists and user has access
    const ipRange = await prisma.ip_ranges.findFirst({
      where: {
        id: ip_range_id,
        OR: [
          { company_id: user.role === 'super_admin' ? undefined : user.company_id },
          { is_shared: true },
        ],
      },
    });

    if (!ipRange) {
      res.status(404).json({ success: false, message: 'IP range not found or access denied' });
      return;
    }

    // Get VMs and verify access
    const vmWhere: any = {
      id: { in: vm_ids },
    };
    if (user.role !== 'super_admin') {
      vmWhere.company_id = user.company_id;
    }

    const vms = await prisma.virtual_machines.findMany({
      where: vmWhere,
      select: { id: true, name: true, vmid: true },
    });

    if (vms.length === 0) {
      res.status(404).json({ success: false, message: 'No accessible VMs found' });
      return;
    }

    const result: BatchAssignmentResult = {
      total: vm_ids.length,
      successful: 0,
      failed: 0,
      skipped: 0,
      details: [],
    };

    // Auto-assign mode: get next available IPs
    let availableIPs: string[] = [];
    if (auto_assign) {
      try {
        availableIPs = await getNextAvailableIPs(ip_range_id, vms.length, start_ip);

        if (availableIPs.length < vms.length) {
          res.status(400).json({
            success: false,
            message: `Not enough available IPs. Found ${availableIPs.length}, need ${vms.length}.`,
          });
          return;
        }
      } catch (error: any) {
        res.status(500).json({
          success: false,
          message: 'Failed to get available IPs: ' + error.message,
        });
        return;
      }
    }

    // Process each VM in transaction
    for (let i = 0; i < vms.length; i++) {
      const vm = vms[i];
      const ipAddress = auto_assign ? availableIPs[i] : undefined;

      try {
        // Check if VM already has IP assignment in this range
        const existingAssignment = await prisma.vm_ip_assignments.findFirst({
          where: {
            vm_id: vm.id,
            ip_range_id: ip_range_id,
          },
        });

        if (existingAssignment) {
          result.skipped++;
          result.details.push({
            vm_id: vm.id,
            vm_name: vm.name,
            ip_address: existingAssignment.ip_address,
            status: 'skipped',
            message: `VM already has IP ${existingAssignment.ip_address} in this range`,
          });
          continue;
        }

        if (!ipAddress) {
          result.failed++;
          result.details.push({
            vm_id: vm.id,
            vm_name: vm.name,
            status: 'failed',
            message: 'No IP address available for assignment',
          });
          continue;
        }

        // Create IP assignment
        await prisma.vm_ip_assignments.create({
          data: {
            vm_id: vm.id,
            ip_range_id: ip_range_id,
            ip_address: ipAddress,
            ip_type: 'internal',
            is_primary: false,
            interface_name: 'net0',
          },
        });

        result.successful++;
        result.details.push({
          vm_id: vm.id,
          vm_name: vm.name,
          ip_address: ipAddress,
          status: 'success',
          message: `Successfully assigned IP ${ipAddress}`,
        });
      } catch (error: any) {
        result.failed++;
        result.details.push({
          vm_id: vm.id,
          vm_name: vm.name,
          status: 'failed',
          message: error.message || 'Failed to assign IP',
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Batch assignment complete: ${result.successful} successful, ${result.failed} failed, ${result.skipped} skipped`,
      data: result,
    });
  } catch (error: any) {
    console.error('Batch assign IPs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to batch assign IPs: ' + error.message,
    });
  }
};

/**
 * Batch unassign IPs from multiple VMs
 * POST /api/batch-ip/unassign
 */
export const batchUnassignIPs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { assignment_ids }: { assignment_ids: number[] } = req.body;

    if (!assignment_ids || !Array.isArray(assignment_ids) || assignment_ids.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Invalid request. assignment_ids array is required.',
      });
      return;
    }

    if (assignment_ids.length > 100) {
      res.status(400).json({
        success: false,
        message: 'Cannot unassign more than 100 IPs at once.',
      });
      return;
    }

    // Get assignments and verify access through VM company_id
    const assignments = await prisma.vm_ip_assignments.findMany({
      where: {
        id: { in: assignment_ids },
      },
      include: {
        virtual_machines: {
          select: {
            id: true,
            name: true,
            company_id: true,
          },
        },
      },
    });

    // Filter by user's company access
    const accessibleAssignments = assignments.filter((a) => {
      if (user.role === 'super_admin') return true;
      return a.virtual_machines?.company_id === user.company_id;
    });

    if (accessibleAssignments.length === 0) {
      res.status(404).json({ success: false, message: 'No accessible IP assignments found' });
      return;
    }

    // Delete assignments
    const deleteResult = await prisma.vm_ip_assignments.deleteMany({
      where: {
        id: { in: accessibleAssignments.map((a) => a.id) },
      },
    });

    res.status(200).json({
      success: true,
      message: `Successfully unassigned ${deleteResult.count} IP addresses`,
      data: {
        total: assignment_ids.length,
        deleted: deleteResult.count,
        skipped: assignment_ids.length - accessibleAssignments.length,
      },
    });
  } catch (error: any) {
    console.error('Batch unassign IPs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to batch unassign IPs: ' + error.message,
    });
  }
};

/**
 * Reassign IPs for VMs (change IP range)
 * POST /api/batch-ip/reassign
 */
export const batchReassignIPs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const {
      old_ip_range_id,
      new_ip_range_id,
      vm_ids,
    }: {
      old_ip_range_id: number;
      new_ip_range_id: number;
      vm_ids: number[];
    } = req.body;

    if (!old_ip_range_id || !new_ip_range_id || !vm_ids || !Array.isArray(vm_ids)) {
      res.status(400).json({
        success: false,
        message: 'old_ip_range_id, new_ip_range_id, and vm_ids are required.',
      });
      return;
    }

    if (vm_ids.length > 100) {
      res.status(400).json({
        success: false,
        message: 'Cannot reassign more than 100 IPs at once.',
      });
      return;
    }

    // Verify new IP range exists and user has access
    const newIPRange = await prisma.ip_ranges.findFirst({
      where: {
        id: new_ip_range_id,
        OR: [
          { company_id: user.role === 'super_admin' ? undefined : user.company_id },
          { is_shared: true },
        ],
      },
    });

    if (!newIPRange) {
      res.status(404).json({
        success: false,
        message: 'New IP range not found or access denied',
      });
      return;
    }

    // Get VMs and verify access
    const vmWhere2: any = {
      id: { in: vm_ids },
    };
    if (user.role !== 'super_admin') {
      vmWhere2.company_id = user.company_id;
    }

    const vms = await prisma.virtual_machines.findMany({
      where: vmWhere2,
      select: { id: true, name: true },
    });

    if (vms.length === 0) {
      res.status(404).json({ success: false, message: 'No accessible VMs found' });
      return;
    }

    // Get available IPs in new range
    const availableIPs = await getNextAvailableIPs(new_ip_range_id, vms.length);

    if (availableIPs.length < vms.length) {
      res.status(400).json({
        success: false,
        message: `Not enough available IPs in new range. Found ${availableIPs.length}, need ${vms.length}.`,
      });
      return;
    }

    const result: BatchAssignmentResult = {
      total: vms.length,
      successful: 0,
      failed: 0,
      skipped: 0,
      details: [],
    };

    // Process reassignment in transaction
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < vms.length; i++) {
        const vm = vms[i];
        const newIP = availableIPs[i];

        try {
          // Delete old assignment
          await tx.vm_ip_assignments.deleteMany({
            where: {
              vm_id: vm.id,
              ip_range_id: old_ip_range_id,
            },
          });

          // Create new assignment
          await tx.vm_ip_assignments.create({
            data: {
              vm_id: vm.id,
              ip_range_id: new_ip_range_id,
              ip_address: newIP,
              ip_type: 'internal',
              is_primary: false,
              interface_name: 'net0',
            },
          });

          result.successful++;
          result.details.push({
            vm_id: vm.id,
            vm_name: vm.name,
            ip_address: newIP,
            status: 'success',
            message: `Successfully reassigned to IP ${newIP}`,
          });
        } catch (error: any) {
          result.failed++;
          result.details.push({
            vm_id: vm.id,
            vm_name: vm.name,
            status: 'failed',
            message: error.message || 'Failed to reassign IP',
          });
          throw error; // Rollback transaction
        }
      }
    });

    res.status(200).json({
      success: true,
      message: `Batch reassignment complete: ${result.successful} successful, ${result.failed} failed`,
      data: result,
    });
  } catch (error: any) {
    console.error('Batch reassign IPs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to batch reassign IPs: ' + error.message,
    });
  }
};

/**
 * Preview batch assignment (dry run)
 * POST /api/batch-ip/preview
 */
export const previewBatchAssignment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { ip_range_id, vm_ids, start_ip }: BatchAssignmentRequest = req.body;

    if (!ip_range_id || !vm_ids || !Array.isArray(vm_ids) || vm_ids.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Invalid request. ip_range_id and vm_ids array are required.',
      });
      return;
    }

    // Verify IP range exists and user has access
    const ipRange = await prisma.ip_ranges.findFirst({
      where: {
        id: ip_range_id,
        OR: [
          { company_id: user.role === 'super_admin' ? undefined : user.company_id },
          { is_shared: true },
        ],
      },
    });

    if (!ipRange) {
      res.status(404).json({ success: false, message: 'IP range not found or access denied' });
      return;
    }

    // Get VMs
    const vmWhere3: any = {
      id: { in: vm_ids },
    };
    if (user.role !== 'super_admin') {
      vmWhere3.company_id = user.company_id;
    }

    const vms = await prisma.virtual_machines.findMany({
      where: vmWhere3,
      select: { id: true, name: true, vmid: true },
    });

    if (vms.length === 0) {
      res.status(404).json({ success: false, message: 'No accessible VMs found' });
      return;
    }

    // Get available IPs
    const availableIPs = await getNextAvailableIPs(ip_range_id, vms.length, start_ip);

    if (availableIPs.length < vms.length) {
      res.status(400).json({
        success: false,
        message: `Not enough available IPs. Found ${availableIPs.length}, need ${vms.length}.`,
        data: {
          requested: vms.length,
          available: availableIPs.length,
          missing: vms.length - availableIPs.length,
        },
      });
      return;
    }

    // Build preview
    const preview = vms.map((vm, index) => ({
      vm_id: vm.id,
      vm_name: vm.name,
      vmid: vm.vmid,
      assigned_ip: availableIPs[index],
    }));

    res.status(200).json({
      success: true,
      message: 'Preview generated successfully',
      data: {
        ip_range: {
          id: ipRange.id,
          subnet: ipRange.subnet,
          description: ipRange.description,
        },
        total_vms: vms.length,
        assignments: preview,
      },
    });
  } catch (error: any) {
    console.error('Preview batch assignment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate preview: ' + error.message,
    });
  }
};

/**
 * Get batch assignment history
 * GET /api/batch-ip/history
 */
export const getBatchAssignmentHistory = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { limit = 50, offset = 0 } = req.query;

    // Get recent IP assignments (grouped by creation time)
    const assignmentWhere: any = {};
    if (user.role !== 'super_admin') {
      assignmentWhere.virtual_machines = {
        company_id: user.company_id,
      };
    }

    const assignments = await prisma.vm_ip_assignments.findMany({
      where: assignmentWhere,
      include: {
        virtual_machines: {
          select: { id: true, name: true, vmid: true },
        },
        ip_ranges: {
          select: { id: true, subnet: true, description: true },
        },
      },
      orderBy: {
        assigned_at: 'desc',
      },
      take: Number(limit),
      skip: Number(offset),
    });

    const total = await prisma.vm_ip_assignments.count({
      where: assignmentWhere,
    });

    res.status(200).json({
      success: true,
      data: {
        assignments,
        pagination: {
          total,
          limit: Number(limit),
          offset: Number(offset),
        },
      },
    });
  } catch (error: any) {
    console.error('Get batch history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get assignment history: ' + error.message,
    });
  }
};
