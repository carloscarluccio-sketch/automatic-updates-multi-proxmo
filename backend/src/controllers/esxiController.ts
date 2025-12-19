import { Request, Response } from 'express';
import { ESXiConnection, ESXiCredentials } from "../services/esxi/ESXiConnection";
import { ESXiDiscoveryService } from "../services/esxi/ESXiDiscoveryService";
import { PrismaClient } from '@prisma/client';
import { encrypt, decrypt } from '../utils/encryption';
import logger from '../utils/logger';

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
    logger.error('Error fetching ESXi hosts:', error);
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
    logger.error('Error fetching ESXi host:', error);
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
    logger.error('Error creating ESXi host:', error);
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
    logger.error('Error updating ESXi host:', error);
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
    logger.error('Error deleting ESXi host:', error);
    res.status(500).json({ success: false, message: 'Failed to delete ESXi host' });
  }
};

// Test ESXi connection - REAL IMPLEMENTATION
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

    try {
      // Decrypt password for connection test
      const password = decrypt(host.password_encrypted);

      // Create ESXi connection credentials
      const credentials: ESXiCredentials = {
        host: host.host,
        port: host.port || 443,
        username: host.username,
        password: password,
        ignoreSSL: true, // For testing - should be configurable in production
      };

      logger.info(`Testing ESXi connection to ${host.host}...`);

      // Create connection and test
      const esxiConnection = new ESXiConnection(credentials);
      const testResult = await esxiConnection.testConnection();

      if (testResult.success) {
        // Update test status as success
        await prisma.esxi_hosts.update({
          where: { id: parseInt(id) },
          data: {
            status: 'active',
            last_tested: new Date(),
            last_test_message: testResult.message || 'Connection successful',
          },
        });

        logger.info(`ESXi connection successful: ${host.host}`);

        res.json({
          success: true,
          message: testResult.message,
          data: {
            status: 'active',
            version: testResult.version,
            apiVersion: testResult.apiVersion,
            build: testResult.build,
            tested_at: new Date(),
          },
        });
      } else {
        // Update test status as failed
        await prisma.esxi_hosts.update({
          where: { id: parseInt(id) },
          data: {
            status: 'error',
            last_tested: new Date(),
            last_test_message: testResult.message || 'Connection failed',
          },
        });

        logger.error(`ESXi connection failed: ${host.host} - ${testResult.message}`);

        res.status(500).json({
          success: false,
          message: testResult.message || 'Connection test failed',
        });
      }
    } catch (error: any) {
      // Update test status as error
      await prisma.esxi_hosts.update({
        where: { id: parseInt(id) },
        data: {
          status: 'error',
          last_tested: new Date(),
          last_test_message: error.message || 'Connection failed',
        },
      });

      logger.error(`ESXi connection error: ${host.host}`, error);

      res.status(500).json({
        success: false,
        message: error.message || 'Connection test failed',
        error: error.message,
      });
    }
  } catch (error: any) {
    logger.error('Error testing ESXi connection:', error);
    res.status(500).json({ success: false, message: 'Failed to test connection' });
  }
};

// Discover VMs from ESXi host - REAL IMPLEMENTATION
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

    try {
      // Decrypt password for API call
      const password = decrypt(host.password_encrypted);

      // Create ESXi connection credentials
      const credentials: ESXiCredentials = {
        host: host.host,
        port: host.port || 443,
        username: host.username,
        password: password,
        ignoreSSL: true,
      };

      logger.info(`Discovering VMs on ESXi host ${host.host}...`);

      // Create connection and discovery service
      const esxiConnection = new ESXiConnection(credentials);
      const discoveryService = new ESXiDiscoveryService(esxiConnection, parseInt(id));

      // Perform VM discovery
      const discoveredVMs = await discoveryService.discoverVMs();

      logger.info(`Discovered ${discoveredVMs.length} VMs on ${host.host}`);

      // Get the saved VMs from database
      const savedVMs = await prisma.esxi_discovered_vms.findMany({
        where: { esxi_host_id: parseInt(id) },
        orderBy: { vm_name: 'asc' },
      });

      res.json({
        success: true,
        message: `VM discovery completed: ${discoveredVMs.length} VMs found`,
        data: {
          host_id: parseInt(id),
          host_name: host.name,
          discovered_count: savedVMs.length,
          vms: savedVMs,
        },
      });
    } catch (error: any) {
      logger.error(`VM discovery failed on ${host.host}:`, error);

      res.status(500).json({
        success: false,
        message: error.message || 'VM discovery failed',
        error: error.message,
      });
    }
  } catch (error: any) {
    logger.error('Error discovering VMs:', error);
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
    logger.error('Error fetching discovered VMs:', error);
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
    // The full implementation would use ESXiImportOrchestrator
    // For now, return a pending status

    logger.info(`VM import initiated: ${vm_ids.length} VMs from ${host.host}`);

    res.json({
      success: true,
      message: 'VM import initiated (full implementation pending)',
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
    logger.error('Error importing VMs:', error);
    res.status(500).json({ success: false, message: 'Failed to import VMs' });
  }
};
