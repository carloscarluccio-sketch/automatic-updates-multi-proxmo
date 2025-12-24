import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';
import ProxmoxESXiImportService from '../services/esxi/ProxmoxESXiImportService';
import { decrypt } from '../utils/encryption';

const prisma = new PrismaClient();

/**
 * Initialize Proxmox import session
 * POST /api/esxi-hosts/:id/proxmox-import/init
 */
export const initProxmoxImport = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log("=== INIT PROXMOX IMPORT ===");
    const hostId = parseInt(req.params.id);
    const { cluster_id } = req.body;
    const user = (req as any).user;

    console.log("ESXi Host ID:", hostId);
    console.log("Cluster ID:", cluster_id);
    console.log("User role:", user?.role);

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    logger.info(`Initializing Proxmox import for ESXi host ${hostId} to cluster ${cluster_id}`);

    // Get ESXi host details
    const host = await prisma.esxi_hosts.findUnique({
      where: { id: hostId }
    });

    if (!host) {
      res.status(404).json({
        success: false,
        message: 'ESXi host not found'
      });
      return;
    }

    // Check access
    if (user.role !== 'super_admin' && host.company_id !== user.company_id) {
      res.status(403).json({
        success: false,
        message: 'Access denied'
      });
      return;
    }

    // Decrypt ESXi password
    const esxiPassword = decrypt(host.password_encrypted);

    // Create import service instance
    const importService = new ProxmoxESXiImportService(
      hostId,
      cluster_id,
      host.company_id || user.company_id
    );

    // Add ESXi storage to Proxmox
    const storageName = `esxi-import-${hostId}-${Date.now()}`;

    console.log("Adding ESXi storage:", storageName);
    await importService.addESXiStorage({
      storage_name: storageName,
      server: host.host,
      username: host.username,
      password: esxiPassword,
      skip_cert_verification: true
    });

    console.log("Listing importable VMs from storage:", storageName);
    // List importable VMs
    const vms = await importService.listImportableVMs(storageName);

    console.log(`Found ${vms.length} importable VMs`);

    res.json({
      success: true,
      data: {
        storage_name: storageName,
        vms: vms
      }
    });
  } catch (error: any) {
    logger.error('Failed to initialize Proxmox import:', error);
    console.error("=== INIT PROXMOX IMPORT ERROR ===");
    console.error("Error:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to initialize import'
    });
  }
};

/**
 * Execute VM import
 * POST /api/esxi-hosts/:id/proxmox-import/execute
 */
export const executeProxmoxImport = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log("=== EXECUTE PROXMOX IMPORT ===");
    const hostId = parseInt(req.params.id);
    const {
      cluster_id,
      storage_name,  // ADDED: Storage name from init
      volid,
      vm_name,
      target_node,
      target_storage,
      target_bridge,
      format,
      vmid,
      start_after_import
    } = req.body;
    const user = (req as any).user;

    console.log("Request body:", req.body);
    console.log("Storage name:", storage_name);
    console.log("Volume ID:", volid);
    console.log("VM name:", vm_name);

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    if (!storage_name) {
      res.status(400).json({
        success: false,
        message: 'storage_name is required - please run init first'
      });
      return;
    }

    logger.info(`Executing Proxmox import for VM ${vm_name} from ${volid}`);

    // Get ESXi host details
    const host = await prisma.esxi_hosts.findUnique({
      where: { id: hostId }
    });

    if (!host) {
      res.status(404).json({
        success: false,
        message: 'ESXi host not found'
      });
      return;
    }

    // Check access
    if (user.role !== 'super_admin' && host.company_id !== user.company_id) {
      res.status(403).json({
        success: false,
        message: 'Access denied'
      });
      return;
    }

    // Create import service instance
    const importService = new ProxmoxESXiImportService(
      hostId,
      cluster_id,
      host.company_id || user.company_id
    );

    console.log("Starting VM import...");

    // Import the VM
    const result = await importService.importVM(
      volid,
      vm_name,
      {
        target_node,
        target_storage,
        bridge: target_bridge,
        format: format || 'raw',
        vmid: vmid,
        start_after_import: start_after_import || false
      },
      storage_name  // ADDED: Pass storage name
    );

    console.log("Import completed successfully:", result);

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    logger.error('Failed to execute Proxmox import:', error);
    console.error("=== EXECUTE IMPORT ERROR ===");
    console.error("Error:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to execute import'
    });
  }
};

/**
 * Get import progress
 * GET /api/esxi-hosts/:id/proxmox-import/progress
 */
export const getImportProgress = async (req: Request, res: Response): Promise<void> => {
  try {
    const hostId = parseInt(req.params.id);
    const { cluster_id, task_id, node_name } = req.query;
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    // Get ESXi host details
    const host = await prisma.esxi_hosts.findUnique({
      where: { id: hostId }
    });

    if (!host) {
      res.status(404).json({
        success: false,
        message: 'ESXi host not found'
      });
      return;
    }

    // Check access
    if (user.role !== 'super_admin' && host.company_id !== user.company_id) {
      res.status(403).json({
        success: false,
        message: 'Access denied'
      });
      return;
    }

    // Create import service instance
    const importService = new ProxmoxESXiImportService(
      hostId,
      parseInt(cluster_id as string),
      host.company_id || user.company_id
    );

    // Get progress
    const progress = await importService.getImportProgress(
      task_id as string,
      node_name as string
    );

    res.json({
      success: true,
      data: progress
    });
  } catch (error: any) {
    logger.error('Failed to get import progress:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get progress'
    });
  }
};

/**
 * Cleanup ESXi storage after import
 * DELETE /api/esxi-hosts/:id/proxmox-import/cleanup
 */
export const cleanupProxmoxImport = async (req: Request, res: Response): Promise<void> => {
  try {
    const hostId = parseInt(req.params.id);
    const { cluster_id, storage_name } = req.body;
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    logger.info(`Cleaning up ESXi storage: ${storage_name}`);

    // Get ESXi host details
    const host = await prisma.esxi_hosts.findUnique({
      where: { id: hostId }
    });

    if (!host) {
      res.status(404).json({
        success: false,
        message: 'ESXi host not found'
      });
      return;
    }

    // Check access
    if (user.role !== 'super_admin' && host.company_id !== user.company_id) {
      res.status(403).json({
        success: false,
        message: 'Access denied'
      });
      return;
    }

    // Create import service instance
    const importService = new ProxmoxESXiImportService(
      hostId,
      cluster_id,
      host.company_id || user.company_id
    );

    // Remove ESXi storage
    await importService.removeESXiStorage(storage_name);

    res.json({
      success: true,
      message: 'ESXi storage removed successfully'
    });
  } catch (error: any) {
    logger.error('Failed to cleanup ESXi storage:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to cleanup'
    });
  }
};
