import { Response } from 'express';
import prisma from '../config/database';
import logger from '../utils/logger';
import { AuthRequest } from '../middlewares/auth';
import ProxmoxAPI from '../utils/proxmoxApi';
import { decrypt } from '../utils/encryption';

export const getVMs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    let vms;
    if (role === 'super_admin') {
      vms = await prisma.virtual_machines.findMany({
        select: {
          id: true,
          name: true,
          vmid: true,
          node: true,
          status: true,
          cpu_cores: true,
          memory_mb: true,
          storage_gb: true,
          cluster_id: true,
          company_id: true,
          created_at: true
        },
        orderBy: { created_at: 'desc' },
      });
    } else {
      vms = await prisma.virtual_machines.findMany({
        where: company_id !== null ? { company_id } : {},
        select: {
          id: true,
          name: true,
          vmid: true,
          node: true,
          status: true,
          cpu_cores: true,
          memory_mb: true,
          storage_gb: true,
          cluster_id: true,
          company_id: true,
          created_at: true
        },
        orderBy: { created_at: 'desc' },
      });
    }
    res.json({ success: true, data: vms });
  } catch (error) {
    logger.error('Get VMs error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch VMs' });
  }
};

export const getVMStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;
    const vm = await prisma.virtual_machines.findFirst({
      where: { id: Number(id), ...(role !== 'super_admin' && company_id !== null ? { company_id } : {}) },
      include: { proxmox_clusters: true },
    });
    if (!vm) { res.status(404).json({ success: false, message: 'VM not found' }); return; }
    if (!vm.proxmox_clusters) { res.status(400).json({ success: false, message: 'VM cluster not found' }); return; }
    if (!vm.proxmox_clusters.port) { res.status(400).json({ success: false, message: 'Cluster port not configured' }); return; }

    const decryptedPassword = decrypt(vm.proxmox_clusters.password_encrypted);
    const proxmox = new ProxmoxAPI({
      host: vm.proxmox_clusters.host,
      port: vm.proxmox_clusters.port,
      username: vm.proxmox_clusters.username
    }, decryptedPassword);
    const status = await proxmox.getVMStatus(vm.node, vm.vmid);
    res.json({ success: true, data: status });
  } catch (error) {
    logger.error('Get VM status error:', error);
    res.status(500).json({ success: false, message: 'Failed to get VM status' });
  }
};

export const controlVM = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { action } = req.body;
    const { role, company_id } = req.user!;
    if (!['start', 'stop'].includes(action)) { res.status(400).json({ success: false, message: 'Invalid action' }); return; }
    const vm = await prisma.virtual_machines.findFirst({
      where: { id: Number(id), ...(role !== 'super_admin' && company_id !== null ? { company_id } : {}) },
      include: { proxmox_clusters: true },
    });
    if (!vm) { res.status(404).json({ success: false, message: 'VM not found' }); return; }
    if (!vm.proxmox_clusters) { res.status(400).json({ success: false, message: 'VM cluster not found' }); return; }
    if (!vm.proxmox_clusters.port) { res.status(400).json({ success: false, message: 'Cluster port not configured' }); return; }

    const decryptedPassword = decrypt(vm.proxmox_clusters.password_encrypted);
    const proxmox = new ProxmoxAPI({
      host: vm.proxmox_clusters.host,
      port: vm.proxmox_clusters.port,
      username: vm.proxmox_clusters.username
    }, decryptedPassword);

    if (action === 'start') await proxmox.startVM(vm.node, vm.vmid);
    else await proxmox.stopVM(vm.node, vm.vmid);

    await prisma.virtual_machines.update({
      where: { id: vm.id },
      data: { status: action === 'start' ? 'running' : 'stopped' }
    });
    res.json({ success: true, message: `VM ${action} command sent` });
  } catch (error) {
    logger.error('Control VM error:', error);
    res.status(500).json({ success: false, message: 'Failed to control VM' });
  }
};
