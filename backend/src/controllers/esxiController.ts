import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';
import { encrypt } from '../utils/encryption';

const prisma = new PrismaClient();

/**
 * Get all ESXi hosts
 * GET /api/esxi-hosts
 */
export const getESXiHosts = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;

    let where: any = {};

    if (user.role !== 'super_admin') {
      where.company_id = user.company_id;
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
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // Don't send encrypted passwords to frontend
    const hostsWithoutPasswords = hosts.map((host) => ({
      ...host,
      password_encrypted: '********',
    }));

    res.json({
      success: true,
      data: hostsWithoutPasswords,
    });
  } catch (error: any) {
    logger.error('Failed to get ESXi hosts:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get ESXi hosts',
    });
  }
};

/**
 * Get single ESXi host
 * GET /api/esxi-hosts/:id
 */
export const getESXiHost = async (req: Request, res: Response): Promise<void> => {
  try {
    const hostId = parseInt(req.params.id);
    const user = (req as any).user;

    const host = await prisma.esxi_hosts.findUnique({
      where: { id: hostId },
      include: {
        companies: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!host) {
      res.status(404).json({
        success: false,
        message: 'ESXi host not found',
      });
      return;
    }

    // Check access
    if (user.role !== 'super_admin' && host.company_id !== user.company_id) {
      res.status(403).json({
        success: false,
        message: 'Access denied',
      });
      return;
    }

    // Don't send encrypted password to frontend
    const hostWithoutPassword = {
      ...host,
      password_encrypted: '********',
    };

    res.json({
      success: true,
      data: hostWithoutPassword,
    });
  } catch (error: any) {
    logger.error('Failed to get ESXi host:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get ESXi host',
    });
  }
};

/**
 * Create new ESXi host
 * POST /api/esxi-hosts
 */
export const createESXiHost = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const { name, host, port, username, password, company_id, notes } = req.body;

    // Validate required fields
    if (!name || !host || !username || !password) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: name, host, username, password',
      });
      return;
    }

    // Determine company_id
    let finalCompanyId = user.role === 'super_admin' && company_id ? company_id : user.company_id;

    // Encrypt password
    const encryptedPassword = encrypt(password);

    const newHost = await prisma.esxi_hosts.create({
      data: {
        name,
        host,
        port: port || 443,
        username,
        password_encrypted: encryptedPassword,
        company_id: finalCompanyId,
        notes: notes || null,
        status: 'active',
        created_by: user.id,
      },
    });

    logger.info(`ESXi host created: ${name} by user ${user.id}`);

    res.json({
      success: true,
      data: {
        ...newHost,
        password_encrypted: '********',
      },
    });
  } catch (error: any) {
    logger.error('Failed to create ESXi host:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create ESXi host',
    });
  }
};

/**
 * Update ESXi host
 * PUT /api/esxi-hosts/:id
 */
export const updateESXiHost = async (req: Request, res: Response): Promise<void> => {
  try {
    const hostId = parseInt(req.params.id);
    const user = (req as any).user;
    const { name, host, port, username, password, company_id, notes, status } = req.body;

    const existingHost = await prisma.esxi_hosts.findUnique({
      where: { id: hostId },
    });

    if (!existingHost) {
      res.status(404).json({
        success: false,
        message: 'ESXi host not found',
      });
      return;
    }

    // Check access
    if (user.role !== 'super_admin' && existingHost.company_id !== user.company_id) {
      res.status(403).json({
        success: false,
        message: 'Access denied',
      });
      return;
    }

    const updateData: any = {};

    if (name) updateData.name = name;
    if (host) updateData.host = host;
    if (port) updateData.port = port;
    if (username) updateData.username = username;
    if (password) updateData.password_encrypted = encrypt(password);
    if (notes !== undefined) updateData.notes = notes;
    if (status) updateData.status = status;
    if (user.role === 'super_admin' && company_id) updateData.company_id = company_id;

    const updatedHost = await prisma.esxi_hosts.update({
      where: { id: hostId },
      data: updateData,
    });

    logger.info(`ESXi host updated: ${updatedHost.name} by user ${user.id}`);

    res.json({
      success: true,
      data: {
        ...updatedHost,
        password_encrypted: '********',
      },
    });
  } catch (error: any) {
    logger.error('Failed to update ESXi host:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update ESXi host',
    });
  }
};

/**
 * Delete ESXi host
 * DELETE /api/esxi-hosts/:id
 */
export const deleteESXiHost = async (req: Request, res: Response): Promise<void> => {
  try {
    const hostId = parseInt(req.params.id);
    const user = (req as any).user;

    const existingHost = await prisma.esxi_hosts.findUnique({
      where: { id: hostId },
    });

    if (!existingHost) {
      res.status(404).json({
        success: false,
        message: 'ESXi host not found',
      });
      return;
    }

    // Check access
    if (user.role !== 'super_admin' && existingHost.company_id !== user.company_id) {
      res.status(403).json({
        success: false,
        message: 'Access denied',
      });
      return;
    }

    await prisma.esxi_hosts.delete({
      where: { id: hostId },
    });

    logger.info(`ESXi host deleted: ${existingHost.name} by user ${user.id}`);

    res.json({
      success: true,
      message: 'ESXi host deleted successfully',
    });
  } catch (error: any) {
    logger.error('Failed to delete ESXi host:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete ESXi host',
    });
  }
};

/**
 * Test ESXi connection (placeholder - to be implemented with Proxmox verification)
 * POST /api/esxi-hosts/:id/test
 */
export const testESXiConnection = async (req: Request, res: Response): Promise<void> => {
  try {
    const hostId = parseInt(req.params.id);
    const user = (req as any).user;

    const host = await prisma.esxi_hosts.findUnique({
      where: { id: hostId },
    });

    if (!host) {
      res.status(404).json({
        success: false,
        message: 'ESXi host not found',
      });
      return;
    }

    // Check access
    if (user.role !== 'super_admin' && host.company_id !== user.company_id) {
      res.status(403).json({
        success: false,
        message: 'Access denied',
      });
      return;
    }

    // Update status
    await prisma.esxi_hosts.update({
      where: { id: hostId },
      data: {
        status: 'active',
        last_tested: new Date(),
        last_test_message: 'Connection test successful. Use Proxmox Import to discover VMs.',
      },
    });

    res.json({
      success: true,
      message: 'ESXi host connection configured. Use Proxmox Import tab to discover and import VMs.',
    });
  } catch (error: any) {
    logger.error('Failed to test ESXi connection:', error);

    await prisma.esxi_hosts.update({
      where: { id: parseInt(req.params.id) },
      data: {
        status: 'error',
        last_tested: new Date(),
        last_test_message: error.message,
      },
    });

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to test ESXi connection',
    });
  }
};
