import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';
import { executeProxmoxAction } from '../utils/proxmoxHelper';

const prisma = new PrismaClient();

interface BulkOperationResult {
  vm_id: number;
  vmid: number;
  name: string;
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Bulk VM operations (start, stop, restart, delete)
 * POST /api/vms/bulk-action
 */
export const bulkVMAction = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const { vm_ids, action } = req.body;

    if (!vm_ids || !Array.isArray(vm_ids) || vm_ids.length === 0) {
      res.status(400).json({ success: false, message: 'vm_ids array is required' });
      return;
    }

    if (!['start', 'stop', 'restart', 'delete'].includes(action)) {
      res.status(400).json({ success: false, message: 'Invalid action. Must be: start, stop, restart, or delete' });
      return;
    }

    // Fetch VMs with role-based filtering
    const where: any = { id: { in: vm_ids } };
    if (user.role !== 'super_admin') {
      where.company_id = user.company_id || 0;
    }

    const vms = await prisma.virtual_machines.findMany({
      where,
      include: {
        proxmox_clusters: true
      }
    });

    if (vms.length === 0) {
      res.status(404).json({ success: false, message: 'No VMs found or access denied' });
      return;
    }

    const results: BulkOperationResult[] = [];

    // Execute actions in parallel
    const promises = vms.map(async (vm) => {
      const result: BulkOperationResult = {
        vm_id: vm.id,
        vmid: vm.vmid || 0,
        name: vm.name,
        success: false,
        message: ''
      };

      try {
        const cluster = vm.proxmox_clusters;
        if (!cluster) {
          result.message = 'Cluster not found';
          result.error = 'Missing cluster association';
          return result;
        }

        // Execute Proxmox action
        const actionResult = await executeProxmoxAction({
          clusterId: cluster.id,
          clusterHost: cluster.host,
          clusterPort: cluster.port || 8006,
          clusterUsername: cluster.username,
          clusterPassword: cluster.password_encrypted,
          vmid: vm.vmid || 0,
          node: vm.node,
          action: action as 'start' | 'stop' | 'restart' | 'delete'
        });

        result.success = actionResult.success;
        result.message = actionResult.message;
        if (!actionResult.success) {
          result.error = actionResult.error;
        }

        // Update VM status in database if not deleting
        if (action !== 'delete' && actionResult.success) {
          const statusMap: any = {
            start: 'running',
            stop: 'stopped',
            restart: 'running'
          };

          await prisma.virtual_machines.update({
            where: { id: vm.id },
            data: { status: statusMap[action] }
          });
        }

        // Delete VM from database if delete action succeeded
        if (action === 'delete' && actionResult.success) {
          await prisma.virtual_machines.delete({
            where: { id: vm.id }
          });
        }

      } catch (error: any) {
        result.success = false;
        result.message = `Failed to ${action} VM`;
        result.error = error.message;
      }

      return result;
    });

    const actionResults = await Promise.all(promises);
    results.push(...actionResults);

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    logger.info(`User ${user.id} performed bulk ${action} on ${vms.length} VMs - ${successCount} succeeded, ${failCount} failed`);

    res.json({
      success: true,
      data: {
        total: results.length,
        successful: successCount,
        failed: failCount,
        results
      }
    });

  } catch (error: any) {
    logger.error('Bulk VM action error:', error);
    res.status(500).json({ success: false, message: 'Bulk operation failed' });
  }
};

/**
 * Bulk update VM metadata
 * PATCH /api/vms/bulk-update
 */
export const bulkVMUpdate = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const { vm_ids, updates } = req.body;

    if (!vm_ids || !Array.isArray(vm_ids) || vm_ids.length === 0) {
      res.status(400).json({ success: false, message: 'vm_ids array is required' });
      return;
    }

    if (!updates || typeof updates !== 'object') {
      res.status(400).json({ success: false, message: 'updates object is required' });
      return;
    }

    // Validate allowed update fields
    const allowedFields = ['project_id', 'tags', 'description', 'notes'];
    const updateData: any = {};

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateData[key] = value;
      }
    }

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ success: false, message: 'No valid fields to update' });
      return;
    }

    // Role-based filtering
    const where: any = { id: { in: vm_ids } };
    if (user.role !== 'super_admin') {
      where.company_id = user.company_id || 0;
    }

    // Update VMs
    const result = await prisma.virtual_machines.updateMany({
      where,
      data: updateData
    });

    logger.info(`User ${user.id} bulk updated ${result.count} VMs with fields: ${Object.keys(updateData).join(', ')}`);

    res.json({
      success: true,
      data: {
        updated_count: result.count,
        fields_updated: Object.keys(updateData)
      }
    });

  } catch (error: any) {
    logger.error('Bulk VM update error:', error);
    res.status(500).json({ success: false, message: 'Bulk update failed' });
  }
};

export default {
  bulkVMAction,
  bulkVMUpdate
};
