/**
 * IP Reservations Controller
 * Phase 2.1: Reserve IPs before VM creation with expiration management
 * Handles CRUD operations for IP reservations
 */

import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../config/database';

/**
 * Create a new IP reservation
 * POST /api/ip-reservations
 */
export const createReservation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      ip_range_id,
      ip_address,
      reserved_for,
      reservation_type = 'vm',
      notes,
      expires_at,
    } = req.body;

    const user = req.user!;

    // Validation
    if (!ip_range_id || !ip_address) {
      res.status(400).json({
        success: false,
        message: 'IP range ID and IP address are required',
      });
      return;
    }

    // Check if IP range exists and user has access
    const ipRange = await prisma.ip_ranges.findFirst({
      where: {
        id: ip_range_id,
        ...(user.role !== 'super_admin' && { company_id: user.company_id }),
      },
    });

    if (!ipRange) {
      res.status(404).json({
        success: false,
        message: 'IP range not found or access denied',
      });
      return;
    }

    // Check if IP is already assigned
    const existingAssignment = await prisma.vm_ip_assignments.findFirst({
      where: {
        ip_address,
        ip_range_id: ip_range_id,
      },
    });

    if (existingAssignment) {
      res.status(409).json({
        success: false,
        message: 'IP address is already assigned to a VM',
        details: {
          vm_id: existingAssignment.vm_id,
        },
      });
      return;
    }

    // Check if IP is already reserved (active reservation)
    const existingReservation = await prisma.ip_reservations.findFirst({
      where: {
        ip_address,
        ip_range_id,
        status: 'active',
      },
    });

    if (existingReservation) {
      res.status(409).json({
        success: false,
        message: 'IP address is already reserved',
        details: {
          reservation_id: existingReservation.id,
          reserved_by: existingReservation.reserved_by,
          expires_at: existingReservation.expires_at,
        },
      });
      return;
    }

    // Validate IP is within range (basic check)
    if (!isIPInRange(ip_address, ipRange.subnet)) {
      res.status(400).json({
        success: false,
        message: 'IP address is not within the specified range',
      });
      return;
    }

    // Create reservation
    const reservation = await prisma.ip_reservations.create({
      data: {
        ip_range_id,
        ip_address,
        reserved_by: user.id,
        reserved_for,
        reservation_type,
        notes,
        expires_at: expires_at ? new Date(expires_at) : null,
        company_id: user.role === 'super_admin' ? ipRange.company_id! : user.company_id!,
        created_by: user.id,
        status: 'active',
      },
      include: {
        ip_ranges: {
          select: {
            subnet: true,
            description: true,
            vlan_id: true,
          },
        },
        users_ip_reservations_reserved_byTousers: {
          select: {
            id: true,
            email: true,
          },
        },
        companies: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json({
      success: true,
      message: 'IP reservation created successfully',
      data: reservation,
    });
  } catch (error: any) {
    console.error('Create reservation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create IP reservation',
      error: error.message,
    });
  }
};

/**
 * List IP reservations with filtering
 * GET /api/ip-reservations
 */
export const listReservations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const {
      status,
      ip_range_id,
      reservation_type,
      include_expired = 'false',
    } = req.query;

    // Build where clause
    const where: any = {
      ...(user.role !== 'super_admin' && { company_id: user.company_id }),
      ...(status && { status: status as string }),
      ...(ip_range_id && { ip_range_id: parseInt(ip_range_id as string) }),
      ...(reservation_type && { reservation_type: reservation_type as string }),
    };

    // Exclude expired by default
    if (include_expired === 'false') {
      where.status = { in: ['active', 'fulfilled'] };
    }

    const reservations = await prisma.ip_reservations.findMany({
      where,
      include: {
        ip_ranges: {
          select: {
            id: true,
            subnet: true,
            description: true,
            vlan_id: true,
          },
        },
        users_ip_reservations_reserved_byTousers: {
          select: {
            id: true,
            email: true,
          },
        },
        companies: {
          select: {
            id: true,
            name: true,
          },
        },
        virtual_machines: {
          select: {
            id: true,
            name: true,
            vmid: true,
          },
        },
      },
      orderBy: {
        reserved_at: 'desc',
      },
    });

    // Calculate expiration status
    const now = new Date();
    const enrichedReservations = reservations.map((r: any) => ({
      ...r,
      is_expired: r.expires_at && new Date(r.expires_at) < now,
      expires_in_hours: r.expires_at
        ? Math.max(0, Math.floor((new Date(r.expires_at).getTime() - now.getTime()) / (1000 * 60 * 60)))
        : null,
    }));

    // Summary statistics
    const summary = {
      total: reservations.length,
      active: reservations.filter((r: any) => r.status === 'active').length,
      expired: reservations.filter((r: any) => r.status === 'expired').length,
      fulfilled: reservations.filter((r: any) => r.status === 'fulfilled').length,
      cancelled: reservations.filter((r: any) => r.status === 'cancelled').length,
      expiring_soon: enrichedReservations.filter((r: any) =>
        r.status === 'active' && r.expires_in_hours !== null && r.expires_in_hours <= 24
      ).length,
    };

    res.json({
      success: true,
      data: enrichedReservations,
      summary,
    });
  } catch (error: any) {
    console.error('List reservations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list IP reservations',
      error: error.message,
    });
  }
};

/**
 * Get single reservation by ID
 * GET /api/ip-reservations/:id
 */
export const getReservation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const whereGet: any = {
      id: parseInt(id),
    };
    if (user.role !== 'super_admin') {
      whereGet.company_id = user.company_id;
    }
    const reservation = await prisma.ip_reservations.findFirst({
      where: whereGet,
      include: {
        ip_ranges: true,
        users_ip_reservations_reserved_byTousers: {
          select: {
            id: true,
            email: true,
          },
        },
        companies: {
          select: {
            id: true,
            name: true,
          },
        },
        virtual_machines: {
          select: {
            id: true,
            name: true,
            vmid: true,
            status: true,
          },
        },
      },
    });

    if (!reservation) {
      res.status(404).json({
        success: false,
        message: 'Reservation not found',
      });
      return;
    }

    res.json({
      success: true,
      data: reservation,
    });
  } catch (error: any) {
    console.error('Get reservation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get reservation',
      error: error.message,
    });
  }
};

/**
 * Update reservation
 * PUT /api/ip-reservations/:id
 */
export const updateReservation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reserved_for, notes, expires_at } = req.body;
    const user = req.user!;

    // Check if reservation exists and user has access
    const where: any = {
      id: parseInt(id),
    };
    if (user.role !== 'super_admin') {
      where.company_id = user.company_id;
    }
    const existing = await prisma.ip_reservations.findFirst({ where });

    if (!existing) {
      res.status(404).json({
        success: false,
        message: 'Reservation not found',
      });
      return;
    }

    // Only allow updating active reservations
    if (existing.status !== 'active') {
      res.status(400).json({
        success: false,
        message: `Cannot update ${existing.status} reservation`,
      });
      return;
    }

    const updated = await prisma.ip_reservations.update({
      where: { id: parseInt(id) },
      data: {
        ...(reserved_for && { reserved_for }),
        ...(notes !== undefined && { notes }),
        ...(expires_at !== undefined && {
          expires_at: expires_at ? new Date(expires_at) : null,
        }),
      },
      include: {
        ip_ranges: {
          select: {
            subnet: true,
            description: true,
          },
        },
        users_ip_reservations_reserved_byTousers: {
          select: {
            email: true,
          },
        },
      },
    });

    res.json({
      success: true,
      message: 'Reservation updated successfully',
      data: updated,
    });
  } catch (error: any) {
    console.error('Update reservation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update reservation',
      error: error.message,
    });
  }
};

/**
 * Cancel reservation
 * DELETE /api/ip-reservations/:id
 */
export const cancelReservation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const where2: any = {
      id: parseInt(id),
    };
    if (user.role !== 'super_admin') {
      where2.company_id = user.company_id;
    }
    const existing = await prisma.ip_reservations.findFirst({ where: where2 });

    if (!existing) {
      res.status(404).json({
        success: false,
        message: 'Reservation not found',
      });
      return;
    }

    // Mark as cancelled instead of deleting
    await prisma.ip_reservations.update({
      where: { id: parseInt(id) },
      data: {
        status: 'cancelled',
      },
    });

    res.json({
      success: true,
      message: 'Reservation cancelled successfully',
    });
  } catch (error: any) {
    console.error('Cancel reservation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel reservation',
      error: error.message,
    });
  }
};

/**
 * Fulfill reservation (mark as used by VM)
 * POST /api/ip-reservations/:id/fulfill
 */
export const fulfillReservation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { vm_id } = req.body;
    const user = req.user!;

    if (!vm_id) {
      res.status(400).json({
        success: false,
        message: 'VM ID is required',
      });
      return;
    }

    const where3: any = {
      id: parseInt(id),
    };
    if (user.role !== 'super_admin') {
      where3.company_id = user.company_id;
    }
    const existing = await prisma.ip_reservations.findFirst({ where: where3 });

    if (!existing) {
      res.status(404).json({
        success: false,
        message: 'Reservation not found',
      });
      return;
    }

    if (existing.status !== 'active') {
      res.status(400).json({
        success: false,
        message: 'Only active reservations can be fulfilled',
      });
      return;
    }

    // Mark as fulfilled
    const updated = await prisma.ip_reservations.update({
      where: { id: parseInt(id) },
      data: {
        status: 'fulfilled',
        vm_id: vm_id,
        fulfilled_at: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'Reservation fulfilled successfully',
      data: updated,
    });
  } catch (error: any) {
    console.error('Fulfill reservation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fulfill reservation',
      error: error.message,
    });
  }
};

/**
 * Cleanup expired reservations (cron job endpoint)
 * POST /api/ip-reservations/cleanup
 */
export const cleanupExpiredReservations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;

    // Only super_admin can run cleanup
    if (user.role !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Permission denied',
      });
      return;
    }

    const now = new Date();

    // Find expired reservations that are still marked as active
    const expiredCount = await prisma.ip_reservations.updateMany({
      where: {
        status: 'active',
        expires_at: {
          lt: now,
        },
      },
      data: {
        status: 'expired',
      },
    });

    res.json({
      success: true,
      message: 'Cleanup completed',
      data: {
        expired_count: expiredCount.count,
      },
    });
  } catch (error: any) {
    console.error('Cleanup error:', error);
    res.status(500).json({
      success: false,
      message: 'Cleanup failed',
      error: error.message,
    });
  }
};

/**
 * Check if IP is available for reservation
 * GET /api/ip-reservations/check-availability
 */
export const checkAvailability = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { ip_address, ip_range_id } = req.query;

    if (!ip_address || !ip_range_id) {
      res.status(400).json({
        success: false,
        message: 'IP address and range ID are required',
      });
      return;
    }

    // Check if assigned
    const assignment = await prisma.vm_ip_assignments.findFirst({
      where: {
        ip_address: ip_address as string,
        ip_range_id: parseInt(ip_range_id as string),
      },
    });

    // Check if reserved
    const reservation = await prisma.ip_reservations.findFirst({
      where: {
        ip_address: ip_address as string,
        ip_range_id: parseInt(ip_range_id as string),
        status: 'active',
      },
    });

    const available = !assignment && !reservation;

    res.json({
      success: true,
      data: {
        available,
        assigned: !!assignment,
        reserved: !!reservation,
        details: {
          assignment: assignment ? {
            vm_id: assignment.vm_id,
            assigned_at: assignment.assigned_at,
          } : null,
          reservation: reservation ? {
            id: reservation.id,
            reserved_by: reservation.reserved_by,
            expires_at: reservation.expires_at,
          } : null,
        },
      },
    });
  } catch (error: any) {
    console.error('Check availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check availability',
      error: error.message,
    });
  }
};

/**
 * Helper function to check if IP is in range
 */
function isIPInRange(ip: string, _cidr: string): boolean {
  // Basic validation - should implement proper CIDR check
  // For now, just check if IP format is valid
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  return ipRegex.test(ip);
}
