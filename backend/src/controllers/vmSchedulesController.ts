import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../config/database';
import logger from '../utils/logger';

/**
 * VM Schedules Controller
 *
 * Manages automated VM actions (start, stop, restart, snapshot)
 * Supports daily, weekly, monthly, and cron schedules
 */

/**
 * Get all VM schedules
 * GET /api/vm-schedules
 */
export const getVMSchedules = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { vm_id, enabled } = req.query;

    let where: any = {};

    // Build where clause based on filters
    if (vm_id) {
      where.vm_id = Number(vm_id);
    }

    if (enabled !== undefined) {
      where.enabled = enabled === 'true' || enabled === '1';
    }

    // If not super_admin, filter by company_id through VM relationship
    if (role !== 'super_admin' && company_id !== null) {
      where.virtual_machines = {
        company_id: company_id,
      };
    }

    const schedules = await prisma.vm_schedules.findMany({
      where,
      include: {
        virtual_machines: {
          select: {
            id: true,
            name: true,
            vmid: true,
            node: true,
            status: true,
            company_id: true,
            companies: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    res.json({ success: true, data: schedules });
  } catch (error: any) {
    logger.error('Get VM schedules error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch VM schedules', error: error.message });
  }
};

/**
 * Get single VM schedule
 * GET /api/vm-schedules/:id
 */
export const getVMSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    const schedule = await prisma.vm_schedules.findUnique({
      where: { id: Number(id) },
      include: {
        virtual_machines: {
          select: {
            id: true,
            name: true,
            vmid: true,
            node: true,
            status: true,
            company_id: true,
          },
        },
      },
    });

    if (!schedule) {
      res.status(404).json({ success: false, message: 'VM schedule not found' });
      return;
    }

    // Check permissions
    if (role !== 'super_admin' && schedule.virtual_machines?.company_id !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied to this schedule' });
      return;
    }

    res.json({ success: true, data: schedule });
  } catch (error: any) {
    logger.error('Get VM schedule error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch VM schedule', error: error.message });
  }
};

/**
 * Create VM schedule
 * POST /api/vm-schedules
 */
export const createVMSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { vm_id, action, schedule_type, schedule_value, enabled } = req.body;
    const { role, company_id } = req.user!;

    // Validate required fields
    if (!vm_id || !action || !schedule_type || !schedule_value) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: vm_id, action, schedule_type, schedule_value',
      });
      return;
    }

    // Verify VM exists and user has access
    const vm = await prisma.virtual_machines.findUnique({
      where: { id: Number(vm_id) },
      select: { id: true, company_id: true, name: true },
    });

    if (!vm) {
      res.status(404).json({ success: false, message: 'VM not found' });
      return;
    }

    // Permission check
    if (role !== 'super_admin' && vm.company_id !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied to this VM' });
      return;
    }

    // Validate schedule_value format based on schedule_type
    const validationError = validateScheduleValue(schedule_type, schedule_value);
    if (validationError) {
      res.status(400).json({ success: false, message: validationError });
      return;
    }

    // Create schedule
    const schedule = await prisma.vm_schedules.create({
      data: {
        vm_id: Number(vm_id),
        action,
        schedule_type,
        schedule_value,
        enabled: enabled !== undefined ? Boolean(enabled) : true,
      },
      include: {
        virtual_machines: {
          select: {
            id: true,
            name: true,
            vmid: true,
            node: true,
          },
        },
      },
    });

    logger.info(`VM schedule created: ${schedule.id} for VM ${vm.name} (${action})`);
    res.status(201).json({ success: true, data: schedule });
  } catch (error: any) {
    logger.error('Create VM schedule error:', error);
    res.status(500).json({ success: false, message: 'Failed to create VM schedule', error: error.message });
  }
};

/**
 * Update VM schedule
 * PUT /api/vm-schedules/:id
 */
export const updateVMSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    // Get existing schedule
    const existing = await prisma.vm_schedules.findUnique({
      where: { id: Number(id) },
      include: {
        virtual_machines: {
          select: { company_id: true },
        },
      },
    });

    if (!existing) {
      res.status(404).json({ success: false, message: 'VM schedule not found' });
      return;
    }

    // Permission check
    if (role !== 'super_admin' && existing.virtual_machines?.company_id !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied to this schedule' });
      return;
    }

    // Build update data
    const updateData: any = {};
    const allowedFields = ['action', 'schedule_type', 'schedule_value', 'enabled'];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'enabled') {
          updateData[field] = Boolean(req.body[field]);
        } else {
          updateData[field] = req.body[field];
        }
      }
    }

    // Validate schedule_value if being updated
    if (updateData.schedule_value || updateData.schedule_type) {
      const typeToValidate = updateData.schedule_type || existing.schedule_type;
      const valueToValidate = updateData.schedule_value || existing.schedule_value;
      const validationError = validateScheduleValue(typeToValidate, valueToValidate);
      if (validationError) {
        res.status(400).json({ success: false, message: validationError });
        return;
      }
    }

    // Update schedule
    const updated = await prisma.vm_schedules.update({
      where: { id: Number(id) },
      data: updateData,
      include: {
        virtual_machines: {
          select: {
            id: true,
            name: true,
            vmid: true,
            node: true,
          },
        },
      },
    });

    logger.info(`VM schedule updated: ${id}`);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    logger.error('Update VM schedule error:', error);
    res.status(500).json({ success: false, message: 'Failed to update VM schedule', error: error.message });
  }
};

/**
 * Delete VM schedule
 * DELETE /api/vm-schedules/:id
 */
export const deleteVMSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    // Get existing schedule
    const existing = await prisma.vm_schedules.findUnique({
      where: { id: Number(id) },
      include: {
        virtual_machines: {
          select: { company_id: true },
        },
      },
    });

    if (!existing) {
      res.status(404).json({ success: false, message: 'VM schedule not found' });
      return;
    }

    // Permission check
    if (role !== 'super_admin' && existing.virtual_machines?.company_id !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied to this schedule' });
      return;
    }

    // Delete schedule
    await prisma.vm_schedules.delete({
      where: { id: Number(id) },
    });

    logger.info(`VM schedule deleted: ${id}`);
    res.json({ success: true, message: 'VM schedule deleted successfully' });
  } catch (error: any) {
    logger.error('Delete VM schedule error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete VM schedule', error: error.message });
  }
};

/**
 * Toggle VM schedule enabled status
 * PATCH /api/vm-schedules/:id/toggle
 */
export const toggleVMSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    // Get existing schedule
    const existing = await prisma.vm_schedules.findUnique({
      where: { id: Number(id) },
      include: {
        virtual_machines: {
          select: { company_id: true },
        },
      },
    });

    if (!existing) {
      res.status(404).json({ success: false, message: 'VM schedule not found' });
      return;
    }

    // Permission check
    if (role !== 'super_admin' && existing.virtual_machines?.company_id !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied to this schedule' });
      return;
    }

    // Toggle enabled status
    const updated = await prisma.vm_schedules.update({
      where: { id: Number(id) },
      data: { enabled: !existing.enabled },
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

    logger.info(`VM schedule toggled: ${id} (enabled: ${updated.enabled})`);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    logger.error('Toggle VM schedule error:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle VM schedule', error: error.message });
  }
};

/**
 * Get VM schedule logs
 * GET /api/vm-schedules/:id/logs
 */
export const getVMScheduleLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const { role, company_id } = req.user!;

    // Get schedule to check permissions
    const schedule = await prisma.vm_schedules.findUnique({
      where: { id: Number(id) },
      include: {
        virtual_machines: {
          select: { company_id: true },
        },
      },
    });

    if (!schedule) {
      res.status(404).json({ success: false, message: 'VM schedule not found' });
      return;
    }

    // Permission check
    if (role !== 'super_admin' && schedule.virtual_machines?.company_id !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied to this schedule' });
      return;
    }

    // Get logs
    const logs = await prisma.vm_schedule_logs.findMany({
      where: { schedule_id: Number(id) },
      orderBy: { executed_at: 'desc' },
      skip: Number(offset),
      take: Number(limit),
    });

    const total = await prisma.vm_schedule_logs.count({
      where: { schedule_id: Number(id) },
    });

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        offset: Number(offset),
        limit: Number(limit),
      },
    });
  } catch (error: any) {
    logger.error('Get VM schedule logs error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch schedule logs', error: error.message });
  }
};

/**
 * Validate schedule_value format based on schedule_type
 */
function validateScheduleValue(scheduleType: string, scheduleValue: string): string | null {
  switch (scheduleType) {
    case 'daily':
      // Format: HH:MM (e.g., "14:30")
      if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(scheduleValue)) {
        return 'Daily schedule must be in HH:MM format (e.g., "14:30")';
      }
      break;

    case 'weekly':
      // Format: DOW:HH:MM (e.g., "1:14:30" for Monday at 14:30)
      if (!/^[0-6]:[0-2][0-9]:[0-5][0-9]$/.test(scheduleValue)) {
        return 'Weekly schedule must be in DOW:HH:MM format (e.g., "1:14:30" for Monday at 14:30, 0=Sunday)';
      }
      break;

    case 'monthly':
      // Format: DD:HH:MM (e.g., "15:14:30" for 15th day at 14:30)
      if (!/^(0[1-9]|[12][0-9]|3[01]):[0-2][0-9]:[0-5][0-9]$/.test(scheduleValue)) {
        return 'Monthly schedule must be in DD:HH:MM format (e.g., "15:14:30" for 15th day at 14:30)';
      }
      break;

    case 'cron':
      // Basic cron validation (5 fields)
      const cronParts = scheduleValue.split(' ');
      if (cronParts.length !== 5) {
        return 'Cron expression must have 5 fields (minute hour day month weekday)';
      }
      break;

    default:
      return `Invalid schedule_type: ${scheduleType}`;
  }

  return null;
}
