import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient();

/**
 * Update VM auto-shutdown settings
 * PATCH /api/vms/:id/auto-shutdown
 */
export const updateAutoShutdown = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const vmId = parseInt(req.params.id);
    const { auto_shutdown_enabled, auto_shutdown_idle_hours } = req.body;

    // Validate
    if (auto_shutdown_idle_hours !== undefined) {
      if (auto_shutdown_idle_hours < 1 || auto_shutdown_idle_hours > 720) {
        res.status(400).json({
          success: false,
          message: 'Idle hours must be between 1 and 720 (30 days)'
        });
        return;
      }
    }

    // Check VM exists and user has access
    const vm = await prisma.virtual_machines.findUnique({
      where: { id: vmId }
    });

    if (!vm) {
      res.status(404).json({ success: false, message: 'VM not found' });
      return;
    }

    if (user.role !== 'super_admin' && vm.company_id !== user.company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    // Update settings
    const updateData: any = {};
    if (auto_shutdown_enabled !== undefined) updateData.auto_shutdown_enabled = auto_shutdown_enabled;
    if (auto_shutdown_idle_hours !== undefined) updateData.auto_shutdown_idle_hours = auto_shutdown_idle_hours;

    const updatedVM = await prisma.virtual_machines.update({
      where: { id: vmId },
      data: updateData,
      select: {
        id: true,
        name: true,
        vmid: true,
        auto_shutdown_enabled: true,
        auto_shutdown_idle_hours: true
      }
    });

    // Log activity
    await prisma.activity_logs.create({
      data: {
        user_id: user.id,
        company_id: vm.company_id,
        activity_type: 'vm_management',
        entity_type: 'vm',
        entity_id: vmId,
        action: 'auto_shutdown_updated',
        description: `Auto-shutdown ${auto_shutdown_enabled ? 'enabled' : 'disabled'} for VM ${vm.name} (idle hours: ${auto_shutdown_idle_hours || vm.auto_shutdown_idle_hours})`,
        status: 'success'
      }
    });

    res.json({ success: true, data: updatedVM });
  } catch (error: any) {
    logger.error('Update auto-shutdown error:', error);
    res.status(500).json({ success: false, message: 'Failed to update auto-shutdown settings' });
  }
};

/**
 * Get auto-shutdown statistics
 * GET /api/vms/auto-shutdown/stats
 */
export const getAutoShutdownStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;

    const where: any = {};
    if (user.role !== 'super_admin') {
      where.company_id = user.company_id;
    }

    const [totalVMs, enabledCount, shutdownHistory] = await Promise.all([
      prisma.virtual_machines.count({ where }),
      prisma.virtual_machines.count({ where: { ...where, auto_shutdown_enabled: true } }),
      prisma.vm_auto_shutdown_log.findMany({
        where: {
          virtual_machines: where.company_id ? { company_id: where.company_id } : undefined
        },
        include: {
          virtual_machines: {
            select: { name: true, vmid: true }
          }
        },
        orderBy: { shutdown_at: 'desc' },
        take: 20
      })
    ]);

    const stats = {
      total_vms: totalVMs,
      enabled_count: enabledCount,
      disabled_count: totalVMs - enabledCount,
      recent_shutdowns: shutdownHistory
    };

    res.json({ success: true, data: stats });
  } catch (error: any) {
    logger.error('Get auto-shutdown stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch statistics' });
  }
};

/**
 * Get VMs with auto-shutdown enabled
 * GET /api/vms/auto-shutdown
 */
export const listAutoShutdownVMs = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;

    const where: any = { auto_shutdown_enabled: true };
    if (user.role !== 'super_admin') {
      where.company_id = user.company_id;
    }

    const vms = await prisma.virtual_machines.findMany({
      where,
      select: {
        id: true,
        name: true,
        vmid: true,
        status: true,
        auto_shutdown_enabled: true,
        auto_shutdown_idle_hours: true,
        companies: { select: { name: true } },
        proxmox_clusters: { select: { name: true } }
      },
      orderBy: { name: 'asc' }
    });

    res.json({ success: true, data: vms });
  } catch (error: any) {
    logger.error('List auto-shutdown VMs error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch VMs' });
  }
};
