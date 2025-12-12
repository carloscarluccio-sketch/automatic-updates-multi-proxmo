import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middlewares/auth';
import logger from '../utils/logger';

export const getSnapshotSchedules = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    let schedules;

    if (role === 'super_admin') {
      schedules = await prisma.snapshot_schedules.findMany({
        include: {
          virtual_machines: {
            select: {
              id: true,
              name: true,
              vmid: true,
              company_id: true,
              companies: {
                select: { id: true, name: true }
              }
            }
          }
        },
        orderBy: { created_at: 'desc' }
      });
    } else {
      // Get only schedules for VMs belonging to user's company
      schedules = await prisma.snapshot_schedules.findMany({
        where: {
          virtual_machines: {
            company_id: company_id!
          }
        },
        include: {
          virtual_machines: {
            select: {
              id: true,
              name: true,
              vmid: true,
              company_id: true,
              companies: {
                select: { id: true, name: true }
              }
            }
          }
        },
        orderBy: { created_at: 'desc' }
      });
    }

    res.json({ success: true, data: schedules });
  } catch (error) {
    logger.error('Get snapshot schedules error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch snapshot schedules' });
  }
};

export const getSnapshotSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    const schedule = await prisma.snapshot_schedules.findUnique({
      where: { id: Number(id) },
      include: {
        virtual_machines: {
          select: {
            id: true,
            name: true,
            vmid: true,
            company_id: true,
            companies: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    if (!schedule) {
      res.status(404).json({ success: false, message: 'Snapshot schedule not found' });
      return;
    }

    // Check permission - only super_admin or users from same company can view
    if (role !== 'super_admin' && schedule.virtual_machines.company_id !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    res.json({ success: true, data: schedule });
  } catch (error) {
    logger.error('Get snapshot schedule error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch snapshot schedule' });
  }
};

export const createSnapshotSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const {
      vm_id,
      schedule_type,
      schedule_value,
      retention_count,
      enabled
    } = req.body;

    // Validate required fields
    if (!vm_id || !schedule_type || !schedule_value) {
      res.status(400).json({ success: false, message: 'VM, schedule type, and schedule value are required' });
      return;
    }

    // Check if VM exists and user has permission
    const vm = await prisma.virtual_machines.findUnique({
      where: { id: vm_id },
      select: { id: true, company_id: true }
    });

    if (!vm) {
      res.status(404).json({ success: false, message: 'Virtual machine not found' });
      return;
    }

    if (role !== 'super_admin' && vm.company_id !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied - VM belongs to another company' });
      return;
    }

    const scheduleData: any = {
      vm_id,
      schedule_type,
      schedule_value,
      retention_count: retention_count || 7,
      enabled: enabled !== undefined ? enabled : true
    };

    const schedule = await prisma.snapshot_schedules.create({
      data: scheduleData,
      include: {
        virtual_machines: {
          select: {
            id: true,
            name: true,
            vmid: true,
            company_id: true,
            companies: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    res.status(201).json({ success: true, data: schedule });
  } catch (error) {
    logger.error('Create snapshot schedule error:', error);
    res.status(500).json({ success: false, message: 'Failed to create snapshot schedule' });
  }
};

export const updateSnapshotSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;
    const {
      vm_id,
      schedule_type,
      schedule_value,
      retention_count,
      enabled
    } = req.body;

    // Check if schedule exists
    const existingSchedule = await prisma.snapshot_schedules.findUnique({
      where: { id: Number(id) },
      include: {
        virtual_machines: {
          select: { company_id: true }
        }
      }
    });

    if (!existingSchedule) {
      res.status(404).json({ success: false, message: 'Snapshot schedule not found' });
      return;
    }

    // Check permission
    if (role !== 'super_admin' && existingSchedule.virtual_machines.company_id !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    // If changing VM, validate new VM and permissions
    if (vm_id && vm_id !== existingSchedule.vm_id) {
      const newVm = await prisma.virtual_machines.findUnique({
        where: { id: vm_id },
        select: { id: true, company_id: true }
      });

      if (!newVm) {
        res.status(404).json({ success: false, message: 'Virtual machine not found' });
        return;
      }

      if (role !== 'super_admin' && newVm.company_id !== company_id) {
        res.status(403).json({ success: false, message: 'Access denied - VM belongs to another company' });
        return;
      }
    }

    const updateData: any = {};
    if (vm_id !== undefined) updateData.vm_id = vm_id;
    if (schedule_type !== undefined) updateData.schedule_type = schedule_type;
    if (schedule_value !== undefined) updateData.schedule_value = schedule_value;
    if (retention_count !== undefined) updateData.retention_count = retention_count;
    if (enabled !== undefined) updateData.enabled = enabled;

    const schedule = await prisma.snapshot_schedules.update({
      where: { id: Number(id) },
      data: updateData,
      include: {
        virtual_machines: {
          select: {
            id: true,
            name: true,
            vmid: true,
            company_id: true,
            companies: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    res.json({ success: true, data: schedule });
  } catch (error) {
    logger.error('Update snapshot schedule error:', error);
    res.status(500).json({ success: false, message: 'Failed to update snapshot schedule' });
  }
};

export const deleteSnapshotSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    // Check if schedule exists
    const schedule = await prisma.snapshot_schedules.findUnique({
      where: { id: Number(id) },
      include: {
        virtual_machines: {
          select: { company_id: true }
        }
      }
    });

    if (!schedule) {
      res.status(404).json({ success: false, message: 'Snapshot schedule not found' });
      return;
    }

    // Check permission
    if (role !== 'super_admin' && schedule.virtual_machines.company_id !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    await prisma.snapshot_schedules.delete({
      where: { id: Number(id) }
    });

    res.json({ success: true, message: 'Snapshot schedule deleted successfully' });
  } catch (error) {
    logger.error('Delete snapshot schedule error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete snapshot schedule' });
  }
};

export const toggleSnapshotSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    // Check if schedule exists
    const schedule = await prisma.snapshot_schedules.findUnique({
      where: { id: Number(id) },
      include: {
        virtual_machines: {
          select: { company_id: true }
        }
      }
    });

    if (!schedule) {
      res.status(404).json({ success: false, message: 'Snapshot schedule not found' });
      return;
    }

    // Check permission
    if (role !== 'super_admin' && schedule.virtual_machines.company_id !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const updatedSchedule = await prisma.snapshot_schedules.update({
      where: { id: Number(id) },
      data: { enabled: !schedule.enabled },
      include: {
        virtual_machines: {
          select: {
            id: true,
            name: true,
            vmid: true,
            company_id: true,
            companies: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    res.json({ success: true, data: updatedSchedule });
  } catch (error) {
    logger.error('Toggle snapshot schedule error:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle snapshot schedule' });
  }
};
