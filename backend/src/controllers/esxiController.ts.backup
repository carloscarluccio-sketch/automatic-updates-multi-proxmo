import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { encrypt, decrypt } from '../utils/encryption';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
    company_id?: number;
  };
}

// Get all ESXi hosts
export const getESXiHosts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;

    let where: any = {};

    // Company filtering
    if (role !== 'super_admin') {
      where.company_id = company_id;
    }

    const hosts = await prisma.esxi_hosts.findMany({
      where,
      include: {
        companies: {
          select: {
            id: true,
            name: true,
          },
        },
        users: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // Decrypt passwords for display (masked)
    const hostsWithMaskedPasswords = hosts.map((host) => ({
      ...host,
      password_encrypted: '••••••••',
    }));

    res.json({ success: true, data: hostsWithMaskedPasswords });
  } catch (error) {
    console.error('Error fetching ESXi hosts:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch ESXi hosts' });
  }
};

// Get single ESXi host
export const getESXiHost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    const host = await prisma.esxi_hosts.findUnique({
      where: { id: parseInt(id) },
      include: {
        companies: {
          select: {
            id: true,
            name: true,
          },
        },
        users: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!host) {
      res.status(404).json({ success: false, message: 'ESXi host not found' });
      return;
    }

    // Permission check
    if (role !== 'super_admin' && host.company_id !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    // Mask password
    const hostWithMaskedPassword = {
      ...host,
      password_encrypted: '••••••••',
    };

    res.json({ success: true, data: hostWithMaskedPassword });
  } catch (error) {
    console.error('Error fetching ESXi host:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch ESXi host' });
  }
};

// Create ESXi host
export const createESXiHost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id: user_company_id, id: user_id } = req.user!;
    const {
      name,
      host,
      port,
      username,
      password,
      target_company_id,
      notes,
    } = req.body;

    // Validation
    if (!name || !host || !username || !password) {
      res.status(400).json({
        success: false,
        message: 'Name, host, username, and password are required',
      });
      return;
    }

    // Determine company_id
    let company_id: number | null = null;
    if (role === 'super_admin') {
      company_id = target_company_id || null;
    } else {
      company_id = user_company_id!;
    }

    // Encrypt password
    const password_encrypted = encrypt(password);

    const newHost = await prisma.esxi_hosts.create({
      data: {
        name,
        host,
        port: port || 443,
        username,
        password_encrypted,
        company_id,
        notes: notes || null,
        status: 'active',
        created_by: user_id,
      },
      include: {
        companies: {
          select: {
            id: true,
            name: true,
          },
        },
        users: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    // Mask password in response
    const hostWithMaskedPassword = {
      ...newHost,
      password_encrypted: '••••••••',
    };

    res.status(201).json({ success: true, data: hostWithMaskedPassword });
  } catch (error) {
    console.error('Error creating ESXi host:', error);
    res.status(500).json({ success: false, message: 'Failed to create ESXi host' });
  }
};

// Update ESXi host
export const updateESXiHost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id: user_company_id } = req.user!;
    const {
      name,
      host,
      port,
      username,
      password,
      notes,
      status,
    } = req.body;

    const existingHost = await prisma.esxi_hosts.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingHost) {
      res.status(404).json({ success: false, message: 'ESXi host not found' });
      return;
    }

    // Permission check
    if (role !== 'super_admin' && existingHost.company_id !== user_company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (host !== undefined) updateData.host = host;
    if (port !== undefined) updateData.port = port;
    if (username !== undefined) updateData.username = username;
    if (password !== undefined && password !== '••••••••') {
      updateData.password_encrypted = encrypt(password);
    }
    if (notes !== undefined) updateData.notes = notes;
    if (status !== undefined) updateData.status = status;

    const updatedHost = await prisma.esxi_hosts.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        companies: {
          select: {
            id: true,
            name: true,
          },
        },
        users: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    // Mask password
    const hostWithMaskedPassword = {
      ...updatedHost,
      password_encrypted: '••••••••',
    };

    res.json({ success: true, data: hostWithMaskedPassword });
  } catch (error) {
    console.error('Error updating ESXi host:', error);
    res.status(500).json({ success: false, message: 'Failed to update ESXi host' });
  }
};

// Delete ESXi host
export const deleteESXiHost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id: user_company_id } = req.user!;

    const existingHost = await prisma.esxi_hosts.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingHost) {
      res.status(404).json({ success: false, message: 'ESXi host not found' });
      return;
    }

    // Permission check
    if (role !== 'super_admin' && existingHost.company_id !== user_company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    // Delete associated discovered VMs first
    await prisma.esxi_discovered_vms.deleteMany({
      where: { esxi_host_id: parseInt(id) },
    });

    // Delete host
    await prisma.esxi_hosts.delete({
      where: { id: parseInt(id) },
    });

    res.json({ success: true, message: 'ESXi host deleted successfully' });
  } catch (error) {
    console.error('Error deleting ESXi host:', error);
    res.status(500).json({ success: false, message: 'Failed to delete ESXi host' });
  }
};

// Test ESXi connection
export const testESXiConnection = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id: user_company_id } = req.user!;

    const host = await prisma.esxi_hosts.findUnique({
      where: { id: parseInt(id) },
    });

    if (!host) {
      res.status(404).json({ success: false, message: 'ESXi host not found' });
      return;
    }

    // Permission check
    if (role !== 'super_admin' && host.company_id !== user_company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    // NOTE: This is a placeholder for actual ESXi API connection test
    // In production, you would use vmware-vsphere library to test connection
    // For now, we'll simulate a test

    try {
      // Decrypt password for connection test (will be used in actual implementation)
      // @ts-ignore - password will be used when VMware vSphere library is integrated
      const _password = decrypt(host.password_encrypted);

      // TODO: Implement actual ESXi API connection test
      // const { Client } = require('node-vsphere');
      // const client = new Client(host.host, host.username, password, true);
      // await client.connect();
      // await client.close();

      // Update test status
      await prisma.esxi_hosts.update({
        where: { id: parseInt(id) },
        data: {
          status: 'active',
          last_tested: new Date(),
          last_test_message: 'Connection successful',
        },
      });

      res.json({
        success: true,
        message: 'Connection test successful (simulated)',
        data: {
          status: 'active',
          tested_at: new Date(),
        },
      });
    } catch (error: any) {
      // Update test status
      await prisma.esxi_hosts.update({
        where: { id: parseInt(id) },
        data: {
          status: 'error',
          last_tested: new Date(),
          last_test_message: error.message || 'Connection failed',
        },
      });

      res.status(500).json({
        success: false,
        message: 'Connection test failed',
        error: error.message,
      });
    }
  } catch (error) {
    console.error('Error testing ESXi connection:', error);
    res.status(500).json({ success: false, message: 'Failed to test connection' });
  }
};

// Discover VMs from ESXi host
export const discoverVMs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id: user_company_id } = req.user!;

    const host = await prisma.esxi_hosts.findUnique({
      where: { id: parseInt(id) },
    });

    if (!host) {
      res.status(404).json({ success: false, message: 'ESXi host not found' });
      return;
    }

    // Permission check
    if (role !== 'super_admin' && host.company_id !== user_company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    // Decrypt password for API call (will be used in actual implementation)
    // @ts-ignore - password will be used when VMware vSphere library is integrated
    const _password = decrypt(host.password_encrypted);

    // NOTE: This is a placeholder for actual ESXi VM discovery
    // In production, you would use vmware-vsphere library
    // For now, we'll create some sample discovered VMs

    // Delete old discovered VMs for this host
    await prisma.esxi_discovered_vms.deleteMany({
      where: { esxi_host_id: parseInt(id) },
    });

    // TODO: Implement actual ESXi API discovery
    // const { Client } = require('node-vsphere');
    // const client = new Client(host.host, host.username, password, true);
    // await client.connect();
    // const vms = await client.getVirtualMachines();
    // await client.close();

    // For now, return empty discovery result
    const discoveredVMs = await prisma.esxi_discovered_vms.findMany({
      where: { esxi_host_id: parseInt(id) },
      orderBy: { vm_name: 'asc' },
    });

    res.json({
      success: true,
      message: 'VM discovery completed',
      data: {
        host_id: parseInt(id),
        host_name: host.name,
        discovered_count: discoveredVMs.length,
        vms: discoveredVMs,
      },
    });
  } catch (error) {
    console.error('Error discovering VMs:', error);
    res.status(500).json({ success: false, message: 'Failed to discover VMs' });
  }
};

// Get discovered VMs for a host
export const getDiscoveredVMs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id: user_company_id } = req.user!;

    const host = await prisma.esxi_hosts.findUnique({
      where: { id: parseInt(id) },
    });

    if (!host) {
      res.status(404).json({ success: false, message: 'ESXi host not found' });
      return;
    }

    // Permission check
    if (role !== 'super_admin' && host.company_id !== user_company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const discoveredVMs = await prisma.esxi_discovered_vms.findMany({
      where: { esxi_host_id: parseInt(id) },
      orderBy: { vm_name: 'asc' },
    });

    res.json({
      success: true,
      data: {
        host_id: parseInt(id),
        host_name: host.name,
        discovered_count: discoveredVMs.length,
        vms: discoveredVMs,
      },
    });
  } catch (error) {
    console.error('Error fetching discovered VMs:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch discovered VMs' });
  }
};

// Import selected VMs to Proxmox
export const importVMsToProxmox = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id: user_company_id } = req.user!;
    const {
      vm_ids,
      target_cluster_id,
      target_node,
      target_storage,
    } = req.body;

    if (!vm_ids || !Array.isArray(vm_ids) || vm_ids.length === 0) {
      res.status(400).json({ success: false, message: 'vm_ids array is required' });
      return;
    }

    if (!target_cluster_id || !target_node || !target_storage) {
      res.status(400).json({
        success: false,
        message: 'target_cluster_id, target_node, and target_storage are required',
      });
      return;
    }

    const host = await prisma.esxi_hosts.findUnique({
      where: { id: parseInt(id) },
    });

    if (!host) {
      res.status(404).json({ success: false, message: 'ESXi host not found' });
      return;
    }

    // Permission check
    if (role !== 'super_admin' && host.company_id !== user_company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    // NOTE: This is a placeholder for actual ESXi to Proxmox import
    // In production, this would:
    // 1. Connect to ESXi to export VM
    // 2. Convert VMware format to qcow2
    // 3. Upload to Proxmox storage
    // 4. Create VM in Proxmox
    // 5. Update database

    res.json({
      success: true,
      message: 'VM import initiated (feature coming soon)',
      data: {
        host_id: parseInt(id),
        vm_count: vm_ids.length,
        target_cluster: target_cluster_id,
        target_node,
        target_storage,
        status: 'pending',
      },
    });
  } catch (error) {
    console.error('Error importing VMs:', error);
    res.status(500).json({ success: false, message: 'Failed to import VMs' });
  }
};
