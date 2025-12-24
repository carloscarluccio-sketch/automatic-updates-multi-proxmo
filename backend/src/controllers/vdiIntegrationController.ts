// @ts-nocheck
// VDI Integration Controller - Provides data access for VDI backend
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { decrypt } from '../utils/encryption';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

/**
 * Get cluster details with decrypted password
 * This allows VDI backend to connect to Proxmox without direct DB access
 */
export const getClusterDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const clusterId = parseInt(id);

    if (isNaN(clusterId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid cluster ID'
      });
    }

    const cluster = await prisma.proxmox_clusters.findUnique({
      where: { id: clusterId },
      select: {
        id: true,
        name: true,
        host: true,
        port: true,
        username: true,
        password_encrypted: true,
        location: true,
        status: true
      }
    });

    if (!cluster) {
      return res.status(404).json({
        success: false,
        message: 'Cluster not found'
      });
    }

    // Decrypt password for VDI backend to use
    let decryptedPassword = '';
    try {
      decryptedPassword = decrypt(cluster.password_encrypted);
    } catch (error: any) {
      console.error('[VDI Integration] Failed to decrypt password:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to decrypt cluster password'
      });
    }

    res.json({
      success: true,
      data: {
        id: cluster.id,
        name: cluster.name,
        host: cluster.host,
        port: cluster.port,
        username: cluster.username,
        password: decryptedPassword,
        location: cluster.location,
        status: cluster.status
      }
    });
  } catch (error: any) {
    console.error('[VDI Integration] Get cluster details error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get all active clusters
 */
export const getClusters = async (_req: Request, res: Response): Promise<void> => {
  try {
    const clusters = await prisma.proxmox_clusters.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        name: true,
        host: true,
        port: true,
        username: true,
        password_encrypted: true,
        location: true,
        status: true
      },
      orderBy: { name: 'asc' }
    });

    // Decrypt passwords for all clusters
    const clustersWithPasswords = clusters.map(cluster => {
      try {
        const password = decrypt(cluster.password_encrypted);
        return {
          id: cluster.id,
          name: cluster.name,
          host: cluster.host,
          port: cluster.port,
          username: cluster.username,
          password: password,
          location: cluster.location,
          status: cluster.status
        };
      } catch (error) {
        console.error(`[VDI Integration] Failed to decrypt password for cluster ${cluster.id}`);
        return null;
      }
    }).filter(c => c !== null);

    res.json({
      success: true,
      data: clustersWithPasswords
    });
  } catch (error: any) {
    console.error('[VDI Integration] Get clusters error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get VM details
 */
export const getVMDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const vmId = parseInt(id);

    if (isNaN(vmId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid VM ID'
      });
    }

    const vm = await prisma.virtual_machines.findUnique({
      where: { id: vmId },
      select: {
        id: true,
        name: true,
        vmid: true,
        node: true,
        cluster_id: true,
        company_id: true,
        status: true,
        cpu_cores: true,
        memory_mb: true,
        storage_gb: true,
        primary_ip_internal: true,
        primary_ip_external: true
      }
    });

    if (!vm) {
      return res.status(404).json({
        success: false,
        message: 'VM not found'
      });
    }

    res.json({
      success: true,
      data: vm
    });
  } catch (error: any) {
    console.error('[VDI Integration] Get VM details error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get company details
 */
export const getCompanyDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const companyId = parseInt(id);

    if (isNaN(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID'
      });
    }

    const company = await prisma.companies.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        contact_email: true,
        status: true
      }
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    res.json({
      success: true,
      data: company
    });
  } catch (error: any) {
    console.error('[VDI Integration] Get company details error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get user details
 */
export const getUserDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        company_id: true,
        status: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error: any) {
    console.error('[VDI Integration] Get user details error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });

  }
};
/**
 * VDI Login - Authenticate user for VDI platform
 * POST /api/vdi-integration/auth/login
 */
export const vdiLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password required'
      });
    }

    // Find user by username
    const user = await prisma.users.findFirst({
      where: { username: username },
      select: {
        id: true,
        username: true,
        email: true,
        password_hash: true,
        role: true,
        company_id: true,
        status: true
      }
    });

    if (!user) {
      console.log(`[VDI Auth] Login failed: User not found - ${username}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (user.status !== 'active') {
      console.log(`[VDI Auth] Login failed: Account ${user.status} - ${username}`);
      return res.status(401).json({
        success: false,
        message: `Account is ${user.status}`
      });
    }

    // Verify password (handles both $2y$ and $2a$ formats)
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      console.log(`[VDI Auth] Login failed: Invalid password - ${username}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        sub: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        company_id: user.company_id
      },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: '24h' }
    );

    console.log(`[VDI Auth] User ${username} logged in successfully`);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          company_id: user.company_id
        }
      }
    });
  } catch (error: any) {
    console.error('[VDI Auth] Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * VDI Me - Get current user info from JWT
 * GET /api/vdi-integration/auth/me
 */
export const vdiMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token format'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as any;

    if (!decoded || !decoded.sub) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    // Fetch user from database
    const user = await prisma.users.findUnique({
      where: { id: decoded.sub },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        company_id: true,
        status: true
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is active
    if (user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: `Account is ${user.status}`
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          company_id: user.company_id
        }
      }
    });
  } catch (error: any) {
    console.error('[VDI Auth] Me error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

/**
 * Get VDI Templates - Fetch all VM templates for VDI desktop pools
 * GET /api/vdi-integration/templates
 */
export const getTemplates = async (req: Request, res: Response): Promise<void> => {
  try {
    const templates = await prisma.vm_templates.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        vmid: true,
        cluster_id: true,
        node_name: true,
        os_type: true,
        os_version: true,
        cpu_cores: true,
        memory_mb: true,
        disk_size_gb: true,
        has_cloud_init: true,
        cloud_init_user: true,
        network_bridge: true,
        network_model: true,
        is_public: true,
        created_at: true,
        updated_at: true
      },
      orderBy: {
        name: "asc"
      }
    });

    res.json({
      success: true,
      data: templates
    });
  } catch (error: any) {
    console.error("[VDI Integration] Get templates error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.users.findMany({
      where: {
        status: 'active'
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        company_id: true,
        created_at: true
      },
      orderBy: {
        username: 'asc'
      }
    });

    res.json({
      success: true,
      data: users
    });
  } catch (error: any) {
    console.error('[VDI Integration] Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};
