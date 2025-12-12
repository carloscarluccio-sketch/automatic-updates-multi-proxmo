import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middlewares/auth';
import logger from '../utils/logger';

export const getDRTestSchedules = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    let schedules;

    if (role === 'super_admin') {
      schedules = await prisma.dr_test_schedules.findMany({
        include: {
          dr_cluster_pairs: {
            select: {
              id: true,
              pair_name: true,
              company_id: true,
              proxmox_clusters_dr_cluster_pairs_primary_cluster_idToproxmox_clusters: {
                select: { id: true, name: true }
              },
              proxmox_clusters_dr_cluster_pairs_dr_cluster_idToproxmox_clusters: {
                select: { id: true, name: true }
              },
              companies: {
                select: { id: true, name: true }
              }
            }
          },
          users: {
            select: { id: true, username: true }
          }
        },
        orderBy: { created_at: 'desc' }
      });
    } else {
      // Get only schedules for cluster pairs belonging to user's company
      schedules = await prisma.dr_test_schedules.findMany({
        where: {
          dr_cluster_pairs: {
            company_id: company_id!
          }
        },
        include: {
          dr_cluster_pairs: {
            select: {
              id: true,
              pair_name: true,
              company_id: true,
              proxmox_clusters_dr_cluster_pairs_primary_cluster_idToproxmox_clusters: {
                select: { id: true, name: true }
              },
              proxmox_clusters_dr_cluster_pairs_dr_cluster_idToproxmox_clusters: {
                select: { id: true, name: true }
              },
              companies: {
                select: { id: true, name: true }
              }
            }
          },
          users: {
            select: { id: true, username: true }
          }
        },
        orderBy: { created_at: 'desc' }
      });
    }

    res.json({ success: true, data: schedules });
  } catch (error) {
    logger.error('Get DR test schedules error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch DR test schedules' });
  }
};

export const getDRTestSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    const schedule = await prisma.dr_test_schedules.findUnique({
      where: { id: Number(id) },
      include: {
        dr_cluster_pairs: {
          select: {
            id: true,
            pair_name: true,
            company_id: true,
            proxmox_clusters_dr_cluster_pairs_primary_cluster_idToproxmox_clusters: {
              select: { id: true, name: true }
            },
            proxmox_clusters_dr_cluster_pairs_dr_cluster_idToproxmox_clusters: {
              select: { id: true, name: true }
            },
            companies: {
              select: { id: true, name: true }
            }
          }
        },
        users: {
          select: { id: true, username: true }
        }
      }
    });

    if (!schedule) {
      res.status(404).json({ success: false, message: 'DR test schedule not found' });
      return;
    }

    // Check permission
    if (role !== 'super_admin' && schedule.dr_cluster_pairs.company_id !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    res.json({ success: true, data: schedule });
  } catch (error) {
    logger.error('Get DR test schedule error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch DR test schedule' });
  }
};

export const createDRTestSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id, id: user_id } = req.user!;
    const {
      cluster_pair_id,
      test_name,
      description,
      cron_schedule,
      test_type,
      test_vms,
      isolated_network,
      cleanup_after_test,
      max_test_duration_minutes,
      notify_on_success,
      notify_on_failure,
      notification_emails,
      schedule_enabled
    } = req.body;

    // Validate required fields
    if (!cluster_pair_id || !test_name) {
      res.status(400).json({ success: false, message: 'Cluster pair and test name are required' });
      return;
    }

    // Check if cluster pair exists and user has permission
    const clusterPair = await prisma.dr_cluster_pairs.findUnique({
      where: { id: cluster_pair_id },
      select: { id: true, company_id: true }
    });

    if (!clusterPair) {
      res.status(404).json({ success: false, message: 'Cluster pair not found' });
      return;
    }

    if (role !== 'super_admin' && clusterPair.company_id !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied - Cluster pair belongs to another company' });
      return;
    }

    const scheduleData: any = {
      cluster_pair_id,
      test_name,
      description: description || null,
      cron_schedule: cron_schedule || '0 2 1 * *', // Default: monthly at 2 AM on the 1st
      test_type: test_type || 'boot_test',
      test_vms: test_vms || null,
      isolated_network: isolated_network !== undefined ? isolated_network : true,
      cleanup_after_test: cleanup_after_test !== undefined ? cleanup_after_test : true,
      max_test_duration_minutes: max_test_duration_minutes || 60,
      notify_on_success: notify_on_success !== undefined ? notify_on_success : false,
      notify_on_failure: notify_on_failure !== undefined ? notify_on_failure : true,
      notification_emails: notification_emails || null,
      schedule_enabled: schedule_enabled !== undefined ? schedule_enabled : true,
      created_by: user_id
    };

    const schedule = await prisma.dr_test_schedules.create({
      data: scheduleData,
      include: {
        dr_cluster_pairs: {
          select: {
            id: true,
            pair_name: true,
            company_id: true,
            proxmox_clusters_dr_cluster_pairs_primary_cluster_idToproxmox_clusters: {
              select: { id: true, name: true }
            },
            proxmox_clusters_dr_cluster_pairs_dr_cluster_idToproxmox_clusters: {
              select: { id: true, name: true }
            },
            companies: {
              select: { id: true, name: true }
            }
          }
        },
        users: {
          select: { id: true, username: true }
        }
      }
    });

    res.status(201).json({ success: true, data: schedule });
  } catch (error) {
    logger.error('Create DR test schedule error:', error);
    res.status(500).json({ success: false, message: 'Failed to create DR test schedule' });
  }
};

export const updateDRTestSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;
    const {
      cluster_pair_id,
      test_name,
      description,
      cron_schedule,
      test_type,
      test_vms,
      isolated_network,
      cleanup_after_test,
      max_test_duration_minutes,
      notify_on_success,
      notify_on_failure,
      notification_emails,
      schedule_enabled
    } = req.body;

    // Check if schedule exists
    const existingSchedule = await prisma.dr_test_schedules.findUnique({
      where: { id: Number(id) },
      include: {
        dr_cluster_pairs: {
          select: { company_id: true }
        }
      }
    });

    if (!existingSchedule) {
      res.status(404).json({ success: false, message: 'DR test schedule not found' });
      return;
    }

    // Check permission
    if (role !== 'super_admin' && existingSchedule.dr_cluster_pairs.company_id !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    // If changing cluster pair, validate new pair and permissions
    if (cluster_pair_id && cluster_pair_id !== existingSchedule.cluster_pair_id) {
      const newClusterPair = await prisma.dr_cluster_pairs.findUnique({
        where: { id: cluster_pair_id },
        select: { id: true, company_id: true }
      });

      if (!newClusterPair) {
        res.status(404).json({ success: false, message: 'Cluster pair not found' });
        return;
      }

      if (role !== 'super_admin' && newClusterPair.company_id !== company_id) {
        res.status(403).json({ success: false, message: 'Access denied - Cluster pair belongs to another company' });
        return;
      }
    }

    const updateData: any = {};
    if (cluster_pair_id !== undefined) updateData.cluster_pair_id = cluster_pair_id;
    if (test_name !== undefined) updateData.test_name = test_name;
    if (description !== undefined) updateData.description = description;
    if (cron_schedule !== undefined) updateData.cron_schedule = cron_schedule;
    if (test_type !== undefined) updateData.test_type = test_type;
    if (test_vms !== undefined) updateData.test_vms = test_vms;
    if (isolated_network !== undefined) updateData.isolated_network = isolated_network;
    if (cleanup_after_test !== undefined) updateData.cleanup_after_test = cleanup_after_test;
    if (max_test_duration_minutes !== undefined) updateData.max_test_duration_minutes = max_test_duration_minutes;
    if (notify_on_success !== undefined) updateData.notify_on_success = notify_on_success;
    if (notify_on_failure !== undefined) updateData.notify_on_failure = notify_on_failure;
    if (notification_emails !== undefined) updateData.notification_emails = notification_emails;
    if (schedule_enabled !== undefined) updateData.schedule_enabled = schedule_enabled;

    const schedule = await prisma.dr_test_schedules.update({
      where: { id: Number(id) },
      data: updateData,
      include: {
        dr_cluster_pairs: {
          select: {
            id: true,
            pair_name: true,
            company_id: true,
            proxmox_clusters_dr_cluster_pairs_primary_cluster_idToproxmox_clusters: {
              select: { id: true, name: true }
            },
            proxmox_clusters_dr_cluster_pairs_dr_cluster_idToproxmox_clusters: {
              select: { id: true, name: true }
            },
            companies: {
              select: { id: true, name: true }
            }
          }
        },
        users: {
          select: { id: true, username: true }
        }
      }
    });

    res.json({ success: true, data: schedule });
  } catch (error) {
    logger.error('Update DR test schedule error:', error);
    res.status(500).json({ success: false, message: 'Failed to update DR test schedule' });
  }
};

export const deleteDRTestSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    // Check if schedule exists
    const schedule = await prisma.dr_test_schedules.findUnique({
      where: { id: Number(id) },
      include: {
        dr_cluster_pairs: {
          select: { company_id: true }
        }
      }
    });

    if (!schedule) {
      res.status(404).json({ success: false, message: 'DR test schedule not found' });
      return;
    }

    // Check permission
    if (role !== 'super_admin' && schedule.dr_cluster_pairs.company_id !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    await prisma.dr_test_schedules.delete({
      where: { id: Number(id) }
    });

    res.json({ success: true, message: 'DR test schedule deleted successfully' });
  } catch (error) {
    logger.error('Delete DR test schedule error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete DR test schedule' });
  }
};

export const toggleDRTestSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    // Check if schedule exists
    const schedule = await prisma.dr_test_schedules.findUnique({
      where: { id: Number(id) },
      include: {
        dr_cluster_pairs: {
          select: { company_id: true }
        }
      }
    });

    if (!schedule) {
      res.status(404).json({ success: false, message: 'DR test schedule not found' });
      return;
    }

    // Check permission
    if (role !== 'super_admin' && schedule.dr_cluster_pairs.company_id !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const updatedSchedule = await prisma.dr_test_schedules.update({
      where: { id: Number(id) },
      data: { schedule_enabled: !schedule.schedule_enabled },
      include: {
        dr_cluster_pairs: {
          select: {
            id: true,
            pair_name: true,
            company_id: true,
            proxmox_clusters_dr_cluster_pairs_primary_cluster_idToproxmox_clusters: {
              select: { id: true, name: true }
            },
            proxmox_clusters_dr_cluster_pairs_dr_cluster_idToproxmox_clusters: {
              select: { id: true, name: true }
            },
            companies: {
              select: { id: true, name: true }
            }
          }
        },
        users: {
          select: { id: true, username: true }
        }
      }
    });

    res.json({ success: true, data: updatedSchedule });
  } catch (error) {
    logger.error('Toggle DR test schedule error:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle DR test schedule' });
  }
};

// Get cluster pairs for dropdown selection
export const getDRClusterPairs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    let clusterPairs;

    if (role === 'super_admin') {
      clusterPairs = await prisma.dr_cluster_pairs.findMany({
        where: { status: 'active' },
        select: {
          id: true,
          pair_name: true,
          company_id: true,
          proxmox_clusters_dr_cluster_pairs_primary_cluster_idToproxmox_clusters: {
            select: { id: true, name: true }
          },
          proxmox_clusters_dr_cluster_pairs_dr_cluster_idToproxmox_clusters: {
            select: { id: true, name: true }
          },
          companies: {
            select: { id: true, name: true }
          }
        },
        orderBy: { pair_name: 'asc' }
      });
    } else {
      clusterPairs = await prisma.dr_cluster_pairs.findMany({
        where: {
          company_id: company_id!,
          status: 'active'
        },
        select: {
          id: true,
          pair_name: true,
          company_id: true,
          proxmox_clusters_dr_cluster_pairs_primary_cluster_idToproxmox_clusters: {
            select: { id: true, name: true }
          },
          proxmox_clusters_dr_cluster_pairs_dr_cluster_idToproxmox_clusters: {
            select: { id: true, name: true }
          },
          companies: {
            select: { id: true, name: true }
          }
        },
        orderBy: { pair_name: 'asc' }
      });
    }

    res.json({ success: true, data: clusterPairs });
  } catch (error) {
    logger.error('Get DR cluster pairs error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch cluster pairs' });
  }
};
