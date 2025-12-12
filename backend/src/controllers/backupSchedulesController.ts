import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middlewares/auth';
import logger from '../utils/logger';

export const getBackupSchedules = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    let schedules;

    if (role === 'super_admin') {
      schedules = await prisma.backup_schedules.findMany({
        include: {
          companies: {
            select: { id: true, name: true },
          },
          virtual_machines: {
            select: { id: true, name: true, vmid: true },
          },
          proxmox_clusters: {
            select: { id: true, name: true },
          },
          users: {
            select: { id: true, username: true },
          },
        },
        orderBy: { created_at: 'desc' },
      });
    } else {
      schedules = await prisma.backup_schedules.findMany({
        where: { company_id: company_id! },
        include: {
          companies: {
            select: { id: true, name: true },
          },
          virtual_machines: {
            select: { id: true, name: true, vmid: true },
          },
          proxmox_clusters: {
            select: { id: true, name: true },
          },
          users: {
            select: { id: true, username: true },
          },
        },
        orderBy: { created_at: 'desc' },
      });
    }

    res.json({ success: true, data: schedules });
  } catch (error) {
    logger.error('Get backup schedules error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch backup schedules' });
  }
};

export const getBackupSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    const schedule = await prisma.backup_schedules.findUnique({
      where: { id: Number(id) },
      include: {
        companies: {
          select: { id: true, name: true },
        },
        virtual_machines: {
          select: { id: true, name: true, vmid: true },
        },
        proxmox_clusters: {
          select: { id: true, name: true },
        },
        users: {
          select: { id: true, username: true },
        },
      },
    });

    if (!schedule) {
      res.status(404).json({ success: false, message: 'Backup schedule not found' });
      return;
    }

    if (role !== 'super_admin' && schedule.company_id !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    res.json({ success: true, data: schedule });
  } catch (error) {
    logger.error('Get backup schedule error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch backup schedule' });
  }
};

export const createBackupSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id, id: user_id } = req.user!;
    const {
      name,
      description,
      vm_id,
      cluster_id,
      schedule_type,
      schedule_time,
      schedule_cron,
      enabled,
      retention_days,
      retention_count,
      compression,
      mode,
      storage_location,
      include_ram,
      notification_email,
      notify_on_success,
      notify_on_failure,
    } = req.body;

    if (!name || !schedule_type) {
      res.status(400).json({ success: false, message: 'Name and schedule type required' });
      return;
    }

    // Validate company access
    let targetCompanyId = company_id;
    if (role === 'super_admin' && req.body.company_id) {
      targetCompanyId = req.body.company_id;
    }

    if (!targetCompanyId) {
      res.status(400).json({ success: false, message: 'Company ID required' });
      return;
    }

    // Calculate next run time based on schedule
    const nextRun = calculateNextRun(schedule_type, schedule_time, schedule_cron);

    const schedule = await prisma.backup_schedules.create({
      data: {
        name,
        description,
        company_id: targetCompanyId,
        vm_id: vm_id || null,
        cluster_id: cluster_id || null,
        schedule_type,
        schedule_time: schedule_time || null,
        schedule_cron: schedule_cron || null,
        enabled: enabled !== undefined ? enabled : true,
        retention_days: retention_days || 7,
        retention_count: retention_count || null,
        compression: compression || 'zstd',
        mode: mode || 'snapshot',
        storage_location: storage_location || null,
        include_ram: include_ram || false,
        notification_email: notification_email || null,
        notify_on_success: notify_on_success || false,
        notify_on_failure: notify_on_failure !== undefined ? notify_on_failure : true,
        next_run: nextRun,
        last_status: 'pending',
        created_by: user_id,
      },
      include: {
        companies: {
          select: { id: true, name: true },
        },
        virtual_machines: {
          select: { id: true, name: true, vmid: true },
        },
      },
    });

    res.status(201).json({ success: true, data: schedule });
  } catch (error) {
    logger.error('Create backup schedule error:', error);
    res.status(500).json({ success: false, message: 'Failed to create backup schedule' });
  }
};

export const updateBackupSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    const existing = await prisma.backup_schedules.findUnique({
      where: { id: Number(id) },
    });

    if (!existing) {
      res.status(404).json({ success: false, message: 'Backup schedule not found' });
      return;
    }

    if (role !== 'super_admin' && existing.company_id !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const {
      name,
      description,
      vm_id,
      cluster_id,
      schedule_type,
      schedule_time,
      schedule_cron,
      enabled,
      retention_days,
      retention_count,
      compression,
      mode,
      storage_location,
      include_ram,
      notification_email,
      notify_on_success,
      notify_on_failure,
    } = req.body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (vm_id !== undefined) updateData.vm_id = vm_id;
    if (cluster_id !== undefined) updateData.cluster_id = cluster_id;
    if (schedule_type !== undefined) updateData.schedule_type = schedule_type;
    if (schedule_time !== undefined) updateData.schedule_time = schedule_time;
    if (schedule_cron !== undefined) updateData.schedule_cron = schedule_cron;
    if (enabled !== undefined) updateData.enabled = enabled;
    if (retention_days !== undefined) updateData.retention_days = retention_days;
    if (retention_count !== undefined) updateData.retention_count = retention_count;
    if (compression !== undefined) updateData.compression = compression;
    if (mode !== undefined) updateData.mode = mode;
    if (storage_location !== undefined) updateData.storage_location = storage_location;
    if (include_ram !== undefined) updateData.include_ram = include_ram;
    if (notification_email !== undefined) updateData.notification_email = notification_email;
    if (notify_on_success !== undefined) updateData.notify_on_success = notify_on_success;
    if (notify_on_failure !== undefined) updateData.notify_on_failure = notify_on_failure;

    // Recalculate next run if schedule changed
    if (schedule_type !== undefined || schedule_time !== undefined || schedule_cron !== undefined) {
      updateData.next_run = calculateNextRun(
        schedule_type || existing.schedule_type,
        schedule_time || existing.schedule_time,
        schedule_cron || existing.schedule_cron
      );
    }

    const schedule = await prisma.backup_schedules.update({
      where: { id: Number(id) },
      data: updateData,
      include: {
        companies: {
          select: { id: true, name: true },
        },
        virtual_machines: {
          select: { id: true, name: true, vmid: true },
        },
      },
    });

    res.json({ success: true, data: schedule });
  } catch (error) {
    logger.error('Update backup schedule error:', error);
    res.status(500).json({ success: false, message: 'Failed to update backup schedule' });
  }
};

export const deleteBackupSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    const existing = await prisma.backup_schedules.findUnique({
      where: { id: Number(id) },
    });

    if (!existing) {
      res.status(404).json({ success: false, message: 'Backup schedule not found' });
      return;
    }

    if (role !== 'super_admin' && existing.company_id !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    await prisma.backup_schedules.delete({
      where: { id: Number(id) },
    });

    res.json({ success: true, message: 'Backup schedule deleted successfully' });
  } catch (error) {
    logger.error('Delete backup schedule error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete backup schedule' });
  }
};

export const toggleBackupSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    const existing = await prisma.backup_schedules.findUnique({
      where: { id: Number(id) },
    });

    if (!existing) {
      res.status(404).json({ success: false, message: 'Backup schedule not found' });
      return;
    }

    if (role !== 'super_admin' && existing.company_id !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const schedule = await prisma.backup_schedules.update({
      where: { id: Number(id) },
      data: { enabled: !existing.enabled },
    });

    res.json({ success: true, data: schedule });
  } catch (error) {
    logger.error('Toggle backup schedule error:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle backup schedule' });
  }
};

// Helper function to calculate next run time
function calculateNextRun(scheduleType: string, scheduleTime: string | null, _scheduleCron: string | null): Date {
  const now = new Date();
  const next = new Date(now);

  switch (scheduleType) {
    case 'hourly':
      next.setHours(next.getHours() + 1);
      next.setMinutes(0);
      next.setSeconds(0);
      break;
    case 'daily':
      if (scheduleTime) {
        const [hours, minutes] = scheduleTime.split(':').map(Number);
        next.setHours(hours, minutes, 0, 0);
        if (next <= now) {
          next.setDate(next.getDate() + 1);
        }
      } else {
        next.setDate(next.getDate() + 1);
      }
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      if (scheduleTime) {
        const [hours, minutes] = scheduleTime.split(':').map(Number);
        next.setHours(hours, minutes, 0, 0);
      }
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      if (scheduleTime) {
        const [hours, minutes] = scheduleTime.split(':').map(Number);
        next.setHours(hours, minutes, 0, 0);
      }
      break;
    case 'once':
      if (scheduleTime) {
        next.setTime(new Date(scheduleTime).getTime());
      }
      break;
    default:
      next.setHours(next.getHours() + 24);
  }

  return next;
}
