import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../config/database';
import logger from '../utils/logger';
import ProxmoxAPI from '../utils/proxmoxApi';
import { decrypt } from '../utils/encryption';

/**
 * Discover VMs from a Proxmox cluster
 * Scans all nodes in the cluster and returns VM information
 */
export const discoverVMs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { cluster_id } = req.body;
    const { role, company_id } = req.user!;

    if (!cluster_id) {
      res.status(400).json({ success: false, message: 'cluster_id is required' });
      return;
    }

    // Get cluster info
    const cluster = await prisma.proxmox_clusters.findUnique({
      where: { id: Number(cluster_id) }
    });

    if (!cluster) {
      res.status(404).json({ success: false, message: 'Cluster not found' });
      return;
    }

    if (!cluster.port) {
      res.status(400).json({ success: false, message: 'Cluster port not configured' });
      return;
    }

    // Access control
    if (role !== 'super_admin') {
      // Check if cluster belongs to user's company
      const companyCluster = await prisma.company_clusters.findFirst({
        where: {
          cluster_id: cluster.id,
          company_id: company_id!
        }
      });

      if (!companyCluster) {
        res.status(403).json({ success: false, message: 'Access denied to this cluster' });
        return;
      }
    }

    // Connect to Proxmox
    const decryptedPassword = decrypt(cluster.password_encrypted);
    const proxmox = new ProxmoxAPI({
      host: cluster.host,
      port: cluster.port,
      username: cluster.username
    }, decryptedPassword);

    // Get all nodes
    const nodes = await proxmox.getNodes();
    logger.info(`Found ${nodes.length} nodes in cluster ${cluster.name}`);

    // Get VMs from each node
    const discoveredVMs: any[] = [];
    for (const node of nodes) {
      try {
        const vms = await proxmox.getVMs(node.node);

        for (const vm of vms) {
          // Skip templates
          if (vm.template === 1) {
            continue;
          }

          // Check if VM already exists in database
          const existingVM = await prisma.virtual_machines.findFirst({
            where: {
              vmid: vm.vmid,
              node: node.node,
              cluster_id: cluster.id
            }
          });

          if (existingVM) {
            continue; // Skip already imported VMs
          }

          // Get VM config for more details
          let vmConfig: any = {};
          try {
            vmConfig = await proxmox.getVMConfig(node.node, vm.vmid);
          } catch (configError) {
            logger.warn(`Could not fetch config for VM ${vm.vmid}:`, configError);
          }

          discoveredVMs.push({
            vmid: vm.vmid,
            name: vm.name || `VM-${vm.vmid}`,
            node: node.node,
            status: vm.status,
            cpu_cores: vmConfig.cores || vm.cpus || 1,
            memory_mb: vmConfig.memory || vm.maxmem ? Math.round(vm.maxmem / 1024 / 1024) : 512,
            storage_gb: vmConfig.storage || vm.maxdisk ? Math.round(vm.maxdisk / 1024 / 1024 / 1024) : 10,
            uptime: vm.uptime || 0,
            ip_address: vmConfig.ipconfig0 || null
          });
        }
      } catch (nodeError: any) {
        logger.error(`Error scanning node ${node.node}:`, nodeError);
      }
    }

    logger.info(`Discovered ${discoveredVMs.length} new VMs in cluster ${cluster.name}`);

    res.json({
      success: true,
      data: {
        cluster_id: cluster.id,
        cluster_name: cluster.name,
        discovered_count: discoveredVMs.length,
        vms: discoveredVMs
      }
    });
  } catch (error: any) {
    logger.error('Discover VMs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to discover VMs',
      error: error.message
    });
  }
};

/**
 * Import discovered VMs into database
 */
export const importVMs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { cluster_id, company_id: targetCompanyId, vms } = req.body;
    const { role, company_id: userCompanyId } = req.user!;

    if (!cluster_id || !vms || !Array.isArray(vms) || vms.length === 0) {
      res.status(400).json({
        success: false,
        message: 'cluster_id and vms array are required'
      });
      return;
    }

    // Determine target company
    let finalCompanyId: number | null = null;
    if (role === 'super_admin') {
      finalCompanyId = targetCompanyId || null;
    } else {
      finalCompanyId = userCompanyId;
    }

    const imported: any[] = [];
    const skipped: any[] = [];
    const errors: any[] = [];

    for (const vmData of vms) {
      try {
        // Check if VM already exists
        const existing = await prisma.virtual_machines.findFirst({
          where: {
            vmid: vmData.vmid,
            node: vmData.node,
            cluster_id: Number(cluster_id)
          }
        });

        if (existing) {
          skipped.push({
            vmid: vmData.vmid,
            name: vmData.name,
            reason: 'Already exists in database'
          });
          continue;
        }

        // Import VM - build data object conditionally
        const vmCreateData: any = {
          name: vmData.name,
          vmid: vmData.vmid,
          node: vmData.node,
          cluster_id: Number(cluster_id),
          cpu_cores: vmData.cpu_cores || 1,
          memory_mb: vmData.memory_mb || 512,
          storage_gb: vmData.storage_gb || 10,
          status: vmData.status || 'unknown'
        };

        if (finalCompanyId !== null) {
          vmCreateData.company_id = finalCompanyId;
        }

        const vm = await prisma.virtual_machines.create({
          data: vmCreateData
        });

        imported.push({
          id: vm.id,
          vmid: vm.vmid,
          name: vm.name,
          node: vm.node
        });

        logger.info(`Imported VM ${vm.vmid} (${vm.name}) for company ${finalCompanyId}`);
      } catch (vmError: any) {
        errors.push({
          vmid: vmData.vmid,
          name: vmData.name,
          error: vmError.message
        });
      }
    }

    logger.info(`Import complete: ${imported.length} imported, ${skipped.length} skipped, ${errors.length} errors`);

    res.json({
      success: true,
      data: {
        imported_count: imported.length,
        skipped_count: skipped.length,
        error_count: errors.length,
        imported,
        skipped,
        errors
      },
      message: `Successfully imported ${imported.length} VMs`
    });
  } catch (error: any) {
    logger.error('Import VMs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to import VMs',
      error: error.message
    });
  }
};

/**
 * Reassign VM to different company
 */
export const reassignVMCompany = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { company_id: newCompanyId } = req.body;
    const { role } = req.user!;

    // Only super_admin can reassign
    if (role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Access denied. Only super_admin can reassign VMs.' });
      return;
    }

    if (newCompanyId === undefined || newCompanyId === null) {
      res.status(400).json({ success: false, message: 'company_id is required' });
      return;
    }

    const vm = await prisma.virtual_machines.findUnique({
      where: { id: Number(id) }
    });

    if (!vm) {
      res.status(404).json({ success: false, message: 'VM not found' });
      return;
    }

    // Verify new company exists (if not null)
    if (newCompanyId !== null) {
      const company = await prisma.companies.findUnique({
        where: { id: Number(newCompanyId) }
      });

      if (!company) {
        res.status(404).json({ success: false, message: 'Target company not found' });
        return;
      }
    }

    const oldCompanyId = vm.company_id;

    // Update VM company - build update data conditionally
    const updateData: any = {};
    if (newCompanyId !== null) {
      updateData.company_id = Number(newCompanyId);
    }

    const updatedVM = await prisma.virtual_machines.update({
      where: { id: Number(id) },
      data: updateData
    });

    logger.info(`VM ${vm.vmid} reassigned from company ${oldCompanyId} to ${newCompanyId}`);

    res.json({
      success: true,
      data: updatedVM,
      message: 'VM reassigned successfully'
    });
  } catch (error: any) {
    logger.error('Reassign VM company error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reassign VM',
      error: error.message
    });
  }
};

/**
 * Get all VMs with filter options for reassignment view
 */
export const getVMsForReassignment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role } = req.user!;
    const { cluster_id, company_id } = req.query;

    // Only super_admin can access this
    if (role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const where: any = {};
    if (cluster_id) where.cluster_id = Number(cluster_id);
    if (company_id !== undefined) {
      where.company_id = company_id === 'null' ? null : Number(company_id);
    }

    const vms = await prisma.virtual_machines.findMany({
      where,
      include: {
        companies: {
          select: {
            id: true,
            name: true
          }
        },
        proxmox_clusters: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    res.json({
      success: true,
      data: vms
    });
  } catch (error: any) {
    logger.error('Get VMs for reassignment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch VMs',
      error: error.message
    });
  }
};
