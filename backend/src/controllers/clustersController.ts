import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth';
import { encrypt, decrypt } from '../utils/encryption';
import { ProxmoxAPI } from '../utils/proxmoxApi';
import logger from '../utils/logger';

const prisma = new PrismaClient();

/**
 * Helper function to log SSH key operations to activity_logs
 */
async function logSSHKeyActivity(
  userId: number | null,
  companyId: number | null,
  action: string,
  description: string,
  status: 'success' | 'failed' | 'in_progress' | 'warning',
  metadata?: any,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    await prisma.activity_logs.create({
      data: {
        user_id: userId,
        company_id: companyId,
        activity_type: 'ssh_key_management',
        entity_type: 'ssh_key',
        entity_id: null,
        action: action,
        description: description,
        status: status,
        metadata: metadata ? JSON.stringify(metadata) : null,
        ip_address: ipAddress,
        user_agent: userAgent
      }
    });
    logger.info(`SSH key activity logged: ${action} - ${status}`);
  } catch (error: any) {
    logger.error('Failed to log SSH key activity:', error);
  }
}

export const getClusters = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { include_version, cluster_id } = req.query;
    let where: any = {};
    if (role !== 'super_admin' && company_id !== null) where.company_id = company_id;
    if (cluster_id) where.id = Number(cluster_id);

    const clusters = await prisma.proxmox_clusters.findMany({
      where,
      select: { id: true, name: true, location: true, host: true, port: true, username: true,
        password_encrypted: true, realm: true, ssl_verify: true, status: true, company_id: true,
        cluster_type: true, nat_ready: true, proxmox_version: true, proxmox_release: true,
        version_last_checked: true, created_at: true, updated_at: true },
      orderBy: { created_at: 'desc' }
    });

    if (include_version === 'true') {
      for (const cluster of clusters) {
        try {
          if (!cluster.port) continue;
          const password = decrypt(cluster.password_encrypted);
          const proxmox = new ProxmoxAPI({ host: cluster.host, port: cluster.port, username: cluster.username }, password);
          const version = await proxmox.getVersion();
          await prisma.proxmox_clusters.update({
            where: { id: cluster.id },
            data: { proxmox_version: version, version_last_checked: new Date() }
          });
          cluster.proxmox_version = version;
        } catch (error) {
          logger.error(`Failed to fetch version for cluster ${cluster.id}:`, error);
        }
      }
    }

    const clustersWithoutPassword = clusters.map(({ password_encrypted, ...cluster }) => cluster);
    res.json({ success: true, data: clustersWithoutPassword });
  } catch (error: any) {
    logger.error('Get clusters error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch clusters',
      error: error.message,
      details: 'An error occurred while retrieving cluster data from the database'
    });
  }
};

export const getCluster = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;
    let where: any = { id: Number(id) };
    if (role !== 'super_admin' && company_id !== null) where.company_id = company_id;

    const cluster = await prisma.proxmox_clusters.findFirst({ where });
    if (!cluster) {
      res.status(404).json({ success: false, message: 'Cluster not found' });
      return;
    }
    res.json({ success: true, data: cluster });
  } catch (error: any) {
    logger.error('Get cluster error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cluster',
      error: error.message,
      details: `Unable to retrieve cluster with ID ${req.params.id}`
    });
  }
};

export const createCluster = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { name, location, host, port, username, password, realm, ssl_verify, status, cluster_type, company_id: requestCompanyId } = req.body;

    if (!name || !host || !username || !password) {
      const missing = [];
      if (!name) missing.push('name');
      if (!host) missing.push('host');
      if (!username) missing.push('username');
      if (!password) missing.push('password');
      res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(', ')}`,
        details: 'Please provide all required cluster connection details'
      });
      return;
    }

    let finalCompanyId = null;
    if (role === 'super_admin') finalCompanyId = requestCompanyId || null;
    else if (company_id !== null) finalCompanyId = company_id;

    const encryptedPassword = encrypt(password);

    const cluster = await prisma.proxmox_clusters.create({
      data: { name, location, host, port: port || 8006, username, password_encrypted: encryptedPassword,
        realm: realm || 'pam', ssl_verify: ssl_verify !== undefined ? ssl_verify : true,
        status: status || 'active', cluster_type: cluster_type || 'shared', company_id: finalCompanyId }
    });

    res.status(201).json({ success: true, data: cluster });
  } catch (error) {
    logger.error('Create cluster error:', error);
    res.status(500).json({ success: false, message: 'Failed to create cluster' });
  }
};

export const updateCluster = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;
    const { name, location, host, port, username, password, realm, ssl_verify, status, cluster_type } = req.body;

    let where: any = { id: Number(id) };
    if (role !== 'super_admin' && company_id !== null) where.company_id = company_id;

    const existing = await prisma.proxmox_clusters.findFirst({ where });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Cluster not found' });
      return;
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (location !== undefined) updateData.location = location;
    if (host !== undefined) updateData.host = host;
    if (port !== undefined) updateData.port = port;
    if (username !== undefined) updateData.username = username;
    if (password !== undefined) updateData.password_encrypted = encrypt(password);
    if (realm !== undefined) updateData.realm = realm;
    if (ssl_verify !== undefined) updateData.ssl_verify = ssl_verify;
    if (status !== undefined) updateData.status = status;
    if (cluster_type !== undefined) updateData.cluster_type = cluster_type;

    const cluster = await prisma.proxmox_clusters.update({ where: { id: Number(id) }, data: updateData });
    res.json({ success: true, data: cluster });
  } catch (error: any) {
    logger.error('Update cluster error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update cluster',
      error: error.message,
      details: `Unable to update cluster with ID ${req.params.id}. Please check your input and try again.`
    });
  }
};

export const deleteCluster = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;
    let where: any = { id: Number(id) };
    if (role !== 'super_admin' && company_id !== null) where.company_id = company_id;

    const cluster = await prisma.proxmox_clusters.findFirst({ where });
    if (!cluster) {
      res.status(404).json({ success: false, message: 'Cluster not found' });
      return;
    }

    const vmCount = await prisma.virtual_machines.count({ where: { cluster_id: Number(id) } });
    if (vmCount > 0) {
      res.status(400).json({ success: false, message: `Cannot delete cluster with ${vmCount} VMs` });
      return;
    }

    await prisma.proxmox_clusters.delete({ where: { id: Number(id) } });
    res.json({ success: true, message: 'Cluster deleted successfully' });
  } catch (error: any) {
    logger.error('Delete cluster error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete cluster',
      error: error.message,
      details: `Unable to delete cluster with ID ${req.params.id}`
    });
  }
};

export const testConnection = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;
    let where: any = { id: Number(id) };
    if (role !== 'super_admin' && company_id !== null) where.company_id = company_id;

    const cluster = await prisma.proxmox_clusters.findFirst({ where });
    if (!cluster) {
      res.status(404).json({ success: false, message: 'Cluster not found' });
      return;
    }

    if (!cluster.port) {
      res.status(400).json({ success: false, message: 'Cluster port not configured' });
      return;
    }

    try {
      const password = decrypt(cluster.password_encrypted);
      const proxmox = new ProxmoxAPI(
        { host: cluster.host, port: cluster.port, username: cluster.username },
        password
      );

      // Try to get version as connection test
      const version = await proxmox.getVersion();
      const nodes = await proxmox.getNodes();

      // Update cluster status and version
      await prisma.proxmox_clusters.update({
        where: { id: cluster.id },
        data: {
          status: 'active',
          proxmox_version: version,
          version_last_checked: new Date()
        }
      });

      res.json({
        success: true,
        message: 'Connection successful',
        data: {
          version,
          node_count: nodes.length,
          nodes: nodes.map((n: any) => n.node || n.name)
        }
      });
    } catch (error: any) {
      logger.error(`Connection test failed for cluster ${cluster.id}:`, error);

      // Update cluster status to offline
      await prisma.proxmox_clusters.update({
        where: { id: cluster.id },
        data: { status: 'offline' }
      });

      const errorDetails = error.code === 'ECONNREFUSED'
        ? `Cannot reach Proxmox server at ${cluster.host}:${cluster.port}. Please verify the server is running and accessible.`
        : error.code === 'ETIMEDOUT'
        ? `Connection to ${cluster.host}:${cluster.port} timed out. Please check network connectivity and firewall rules.`
        : error.message?.includes('authentication') || error.message?.includes('credentials')
        ? `Authentication failed for ${cluster.username}. Please verify the username and password are correct.`
        : `Unable to connect to Proxmox cluster at ${cluster.host}:${cluster.port}`;

      res.status(503).json({
        success: false,
        message: 'Connection test failed',
        error: error.message || 'Unable to connect to Proxmox cluster',
        details: errorDetails
      });
    }
  } catch (error: any) {
    logger.error('Test connection error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test connection',
      error: error.message,
      details: 'An unexpected error occurred while testing the cluster connection'
    });
  }
};

// NEW: Get nodes from a cluster
export const getClusterNodes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;
    let where: any = { id: Number(id) };
    if (role !== 'super_admin' && company_id !== null) where.company_id = company_id;

    const cluster = await prisma.proxmox_clusters.findFirst({ where });
    if (!cluster) {
      res.status(404).json({ success: false, message: 'Cluster not found' });
      return;
    }

    if (!cluster.port) {
      res.status(400).json({ success: false, message: 'Cluster port not configured' });
      return;
    }

    const password = decrypt(cluster.password_encrypted);
    const proxmox = new ProxmoxAPI(
      { host: cluster.host, port: cluster.port, username: cluster.username },
      password
    );

    const nodes = await proxmox.getNodes();
    res.json({ success: true, data: nodes });
  } catch (error: any) {
    logger.error('Get cluster nodes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cluster nodes',
      error: error.message
    });
  }
};

// NEW: Get storages for a node in a cluster
export const getClusterStorages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, node } = req.params;
    const { role, company_id } = req.user!;
    let where: any = { id: Number(id) };
    if (role !== 'super_admin' && company_id !== null) where.company_id = company_id;

    const cluster = await prisma.proxmox_clusters.findFirst({ where });
    if (!cluster) {
      res.status(404).json({ success: false, message: 'Cluster not found' });
      return;
    }

    if (!cluster.port) {
      res.status(400).json({ success: false, message: 'Cluster port not configured' });
      return;
    }

    if (!node) {
      res.status(400).json({ success: false, message: 'Node parameter is required' });
      return;
    }

    const password = decrypt(cluster.password_encrypted);
    const proxmox = new ProxmoxAPI(
      { host: cluster.host, port: cluster.port, username: cluster.username },
      password
    );

    const storages = await proxmox.getStorages(node);
    res.json({ success: true, data: storages });
  } catch (error: any) {
    logger.error('Get cluster storages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cluster storages',
      error: error.message
    });
  }
};

// NEW: Get ISOs for a node in a cluster
export const getClusterISOs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, node } = req.params;
    const { role, company_id } = req.user!;
    let where: any = { id: Number(id) };
    if (role !== 'super_admin' && company_id !== null) where.company_id = company_id;

    const cluster = await prisma.proxmox_clusters.findFirst({ where });
    if (!cluster) {
      res.status(404).json({ success: false, message: 'Cluster not found' });
      return;
    }

    if (!cluster.port) {
      res.status(400).json({ success: false, message: 'Cluster port not configured' });
      return;
    }

    if (!node) {
      res.status(400).json({ success: false, message: 'Node parameter is required' });
      return;
    }

    const password = decrypt(cluster.password_encrypted);
    const proxmox = new ProxmoxAPI(
      { host: cluster.host, port: cluster.port, username: cluster.username },
      password
    );

    const isos = await proxmox.getAllISOs(node);
    res.json({ success: true, data: isos });
  } catch (error: any) {
    logger.error('Get cluster ISOs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cluster ISOs',
      error: error.message
    });
  }
};

// NEW: Get templates for a node in a cluster
export const getClusterTemplates = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, node } = req.params;
    const { role, company_id } = req.user!;
    let where: any = { id: Number(id) };
    if (role !== 'super_admin' && company_id !== null) where.company_id = company_id;

    const cluster = await prisma.proxmox_clusters.findFirst({ where });
    if (!cluster) {
      res.status(404).json({ success: false, message: 'Cluster not found' });
      return;
    }

    if (!cluster.port) {
      res.status(400).json({ success: false, message: 'Cluster port not configured' });
      return;
    }

    if (!node) {
      res.status(400).json({ success: false, message: 'Node parameter is required' });
      return;
    }

    const password = decrypt(cluster.password_encrypted);
    const proxmox = new ProxmoxAPI(
      { host: cluster.host, port: cluster.port, username: cluster.username },
      password
    );

    const templates = await proxmox.getTemplates(node);
    res.json({ success: true, data: templates });
  } catch (error: any) {
    logger.error('Get cluster templates error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cluster templates',
      error: error.message
    });
  }
};

// NEW: Get next available VMID from cluster
export const getNextVMID = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;
    let where: any = { id: Number(id) };
    if (role !== 'super_admin' && company_id !== null) where.company_id = company_id;

    const cluster = await prisma.proxmox_clusters.findFirst({ where });
    if (!cluster) {
      res.status(404).json({ success: false, message: 'Cluster not found' });
      return;
    }

    if (!cluster.port) {
      res.status(400).json({ success: false, message: 'Cluster port not configured' });
      return;
    }

    const password = decrypt(cluster.password_encrypted);
    const proxmox = new ProxmoxAPI(
      { host: cluster.host, port: cluster.port, username: cluster.username },
      password
    );

    // Get next VMID from Proxmox
    let vmid = await proxmox.getNextVMID();

    // Check if VMID already exists in our database for this cluster
    let existingVM = await prisma.virtual_machines.findFirst({
      where: {
        cluster_id: Number(id),
        vmid: vmid
      }
    });

    // If VMID exists in database, find the next available one
    while (existingVM) {
      vmid++;
      existingVM = await prisma.virtual_machines.findFirst({
        where: {
          cluster_id: Number(id),
          vmid: vmid
        }
      });
    }

    res.json({ success: true, data: { vmid } });
  } catch (error: any) {
    logger.error('Get next VMID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get next VMID',
      error: error.message
    });
  }
};

// ============================================================================
// SSH Key Management Functions
// ============================================================================

import { Client as SSH2Client } from 'ssh2';
import fs from 'fs';
import { execSync } from 'child_process';

/**
 * Test SSH key-based authentication to Proxmox cluster
 * Helper function (not exposed as API endpoint)
 */
async function testSSHKeyAuth(host: string, username: string): Promise<{ success: boolean; output: string }> {
  const privateKeyPath = '/root/.ssh/id_rsa';

  if (!fs.existsSync(privateKeyPath)) {
    return { success: false, output: 'Private key not found' };
  }

  const privateKey = fs.readFileSync(privateKeyPath);
  const sshClient = new SSH2Client();

  try {
    const result = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        sshClient.end();
        reject(new Error('Timeout'));
      }, 10000);

      sshClient.on('ready', () => {
        clearTimeout(timeout);

        sshClient.exec('echo "SSH_KEY_AUTH_WORKING" && hostname', (err, stream) => {
          if (err) {
            sshClient.end();
            return reject(err);
          }

          let output = '';
          stream.on('data', (data: Buffer) => {
            output += data.toString();
          });

          stream.on('close', () => {
            sshClient.end();
            resolve(output);
          });
        });
      });

      sshClient.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      // Connect with key-based auth (no password)
      sshClient.connect({
        host: host,
        port: 22,
        username: username,
        privateKey: privateKey,
        readyTimeout: 10000
      });
    });

    return { success: true, output: result.trim() };
  } catch (error: any) {
    return { success: false, output: error.message };
  }
}

/**
 * Push SSH public key to Proxmox cluster
 * POST /api/clusters/:id/push-ssh-key
 */
export const pushSSHKey = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const clusterId = parseInt(req.params.id);
    const user = req.user!;

    // Get cluster from database
    const cluster = await prisma.proxmox_clusters.findUnique({
      where: { id: clusterId }
    });

    if (!cluster) {
      res.status(404).json({
        success: false,
        message: 'Cluster not found'
      });
      return;
    }

    // Permission check
    if (user.role !== 'super_admin' && cluster.company_id !== user.company_id) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions to manage this cluster'
      });
      return;
    }

    // Check if SSH public key exists
    const publicKeyPath = '/root/.ssh/id_rsa.pub';
    if (!fs.existsSync(publicKeyPath)) {
      res.status(500).json({
        success: false,
        message: 'SSH public key not found. Please generate SSH keys first.',
        error: 'Run: ssh-keygen -t rsa -b 4096 -C "nat-backend@multpanel" -f /root/.ssh/id_rsa -N ""'
      });
      return;
    }

    // Read public key
    const publicKey = fs.readFileSync(publicKeyPath, 'utf-8').trim();

    // Decrypt Proxmox password
    const decryptedPassword = decrypt(cluster.password_encrypted);
    const username = cluster.username.split('@')[0]; // Remove @pam if present

    // Connect to Proxmox via SSH and add public key
    const sshClient = new SSH2Client();

    const result = await new Promise<{ success: boolean; message: string; output?: string }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        sshClient.end();
        reject(new Error('Connection timeout (15 seconds)'));
      }, 15000);

      sshClient.on('ready', () => {
        clearTimeout(timeout);

        // Execute commands to add SSH key
        const commands = [
          'mkdir -p ~/.ssh',
          'chmod 700 ~/.ssh',
          `echo '${publicKey}' >> ~/.ssh/authorized_keys`,
          'chmod 600 ~/.ssh/authorized_keys',
          // Remove duplicate keys (in case it was added before)
          'sort -u ~/.ssh/authorized_keys -o ~/.ssh/authorized_keys',
          // Verify key was added
          `grep -q '${publicKey.split(' ')[1].substring(0, 50)}' ~/.ssh/authorized_keys && echo "SSH_KEY_VERIFIED" || echo "SSH_KEY_NOT_FOUND"`
        ].join(' && ');

        sshClient.exec(commands, (err, stream) => {
          if (err) {
            sshClient.end();
            return reject(err);
          }

          let output = '';
          let errorOutput = '';

          stream.on('data', (data: Buffer) => {
            output += data.toString();
          });

          stream.stderr.on('data', (data: Buffer) => {
            errorOutput += data.toString();
          });

          stream.on('close', (code: number) => {
            sshClient.end();

            if (code !== 0) {
              return resolve({
                success: false,
                message: `Command failed with exit code ${code}`,
                output: errorOutput || output
              });
            }

            // Check if key was verified
            if (output.includes('SSH_KEY_VERIFIED')) {
              resolve({
                success: true,
                message: 'SSH public key successfully added to Proxmox cluster',
                output: output.trim()
              });
            } else {
              resolve({
                success: false,
                message: 'SSH key was added but could not be verified',
                output: output.trim()
              });
            }
          });
        });
      });

      sshClient.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      // Connect with password authentication
      sshClient.connect({
        host: cluster.host,
        port: 22,
        username: username,
        password: decryptedPassword,
        readyTimeout: 15000
      });
    });

    if (result.success) {
      // Test key-based authentication works now
      const testResult = await testSSHKeyAuth(cluster.host, username);

      // Log activity
      await logSSHKeyActivity(
        user.id,
        cluster.company_id,
        'push_ssh_key',
        `SSH key pushed to cluster: ${cluster.name}`,
        testResult.success ? 'success' : 'warning',
        {
          clusterId: cluster.id,
          clusterName: cluster.name,
          clusterHost: cluster.host,
          keyVerified: testResult.success
        },
        req.ip,
        req.headers['user-agent']
      );

      res.json({
        success: true,
        message: result.message,
        data: {
          keyAdded: true,
          keyVerified: testResult.success,
          authMethod: testResult.success ? 'SSH Key' : 'Password',
          output: result.output,
          testOutput: testResult.output
        }
      });
    } else {
      // Log failure
      await logSSHKeyActivity(
        user.id,
        cluster.company_id,
        'push_ssh_key',
        `Failed to push SSH key to cluster: ${cluster.name}`,
        'failed',
        {
          clusterId: cluster.id,
          clusterName: cluster.name,
          clusterHost: cluster.host,
          error: result.message
        },
        req.ip,
        req.headers['user-agent']
      );

      res.status(500).json({
        success: false,
        message: result.message,
        error: result.output
      });
    }

  } catch (error: any) {
    logger.error('Push SSH key error:', error);

    let message = 'Failed to push SSH key';
    if (error.message.includes('timeout')) {
      message = 'Connection timeout - Host unreachable or firewall blocking port 22';
    } else if (error.message.includes('authentication')) {
      message = 'Authentication failed - Check cluster password';
    } else if (error.message.includes('ECONNREFUSED')) {
      message = 'Connection refused - SSH service not running on Proxmox';
    }

    res.status(500).json({
      success: false,
      message: message,
      error: error.message
    });
  }
};

/**
 * Get SSH key status for a Proxmox cluster
 * GET /api/clusters/:id/ssh-key-status
 */
export const getSSHKeyStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const clusterId = parseInt(req.params.id);
    const user = req.user!;

    // Get cluster from database
    const cluster = await prisma.proxmox_clusters.findUnique({
      where: { id: clusterId }
    });

    if (!cluster) {
      res.status(404).json({
        success: false,
        message: 'Cluster not found'
      });
      return;
    }

    // Permission check
    if (user.role !== 'super_admin' && cluster.company_id !== user.company_id) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
      return;
    }

    // Check if SSH keys exist on backend
    const privateKeyExists = fs.existsSync('/root/.ssh/id_rsa');
    const publicKeyExists = fs.existsSync('/root/.ssh/id_rsa.pub');

    if (!privateKeyExists || !publicKeyExists) {
      res.json({
        success: true,
        data: {
          keysGenerated: false,
          keyAuthWorking: false,
          message: 'SSH keys not generated on backend'
        }
      });
      return;
    }

    // Test if key-based auth works
    const username = cluster.username.split('@')[0];
    const testResult = await testSSHKeyAuth(cluster.host, username);

    res.json({
      success: true,
      data: {
        keysGenerated: true,
        keyAuthWorking: testResult.success,
        message: testResult.success
          ? 'SSH key authentication is working'
          : 'SSH key not configured on Proxmox cluster',
        testOutput: testResult.output
      }
    });

  } catch (error: any) {
    logger.error('Get SSH key status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check SSH key status',
      error: error.message
    });
  }
};

/**
 * Get SSH public key content
 * GET /api/clusters/ssh-public-key
 */
export const getSSHPublicKey = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;

    // Only super_admin and company_admin can view SSH keys
    if (user.role === 'user') {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
      return;
    }

    const publicKeyPath = '/root/.ssh/id_rsa.pub';

    if (!fs.existsSync(publicKeyPath)) {
      res.status(404).json({
        success: false,
        message: 'SSH public key not found. Keys not generated yet.',
        generateCommand: 'ssh-keygen -t rsa -b 4096 -C "nat-backend@multpanel" -f /root/.ssh/id_rsa -N ""'
      });
      return;
    }

    const publicKey = fs.readFileSync(publicKeyPath, 'utf-8').trim();
    const fingerprint = execSync(`ssh-keygen -lf ${publicKeyPath}`)
      .toString()
      .trim();

    res.json({
      success: true,
      data: {
        publicKey: publicKey,
        fingerprint: fingerprint,
        location: publicKeyPath
      }
    });

  } catch (error: any) {
    logger.error('Get SSH public key error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve SSH public key',
      error: error.message
    });
  }
};

/**
 * Generate SSH keys if they don't exist
 * POST /api/clusters/generate-ssh-keys
 */
export const generateSSHKeys = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;

    // Only super_admin can generate SSH keys
    if (user.role !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Only super administrators can generate SSH keys'
      });
      return;
    }

    const privateKeyPath = '/root/.ssh/id_rsa';
    const publicKeyPath = '/root/.ssh/id_rsa.pub';

    // Check if keys already exist
    if (fs.existsSync(privateKeyPath)) {
      const publicKey = fs.readFileSync(publicKeyPath, 'utf-8').trim();
      const fingerprint = execSync(`ssh-keygen -lf ${publicKeyPath}`)
        .toString()
        .trim();

      res.json({
        success: true,
        message: 'SSH keys already exist',
        data: {
          existing: true,
          publicKey: publicKey,
          fingerprint: fingerprint
        }
      });
      return;
    }

    // Generate SSH keys
    // Ensure .ssh directory exists
    execSync('mkdir -p /root/.ssh && chmod 700 /root/.ssh');

    // Generate key pair
    execSync(`ssh-keygen -t rsa -b 4096 -C "nat-backend@multpanel" -f ${privateKeyPath} -N ""`);

    // Set correct permissions
    execSync(`chmod 600 ${privateKeyPath} && chmod 644 ${publicKeyPath}`);

    // Read generated keys
    const publicKey = fs.readFileSync(publicKeyPath, 'utf-8').trim();
    const fingerprint = execSync(`ssh-keygen -lf ${publicKeyPath}`).toString().trim();

    // Log activity
    await logSSHKeyActivity(
      user.id,
      null, // Global operation, not company-specific
      'generate_ssh_keys',
      `SSH keys generated successfully`,
      'success',
      { fingerprint, keyType: 'RSA 4096' },
      req.ip,
      req.headers['user-agent']
    );

    res.json({
      success: true,
      message: 'SSH keys generated successfully',
      data: {
        existing: false,
        publicKey: publicKey,
        fingerprint: fingerprint,
        privateKeyPath: privateKeyPath,
        publicKeyPath: publicKeyPath
      }
    });

  } catch (error: any) {
    logger.error('Generate SSH keys error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate SSH keys',
      error: error.message
    });
  }
};

/**
 * Rotate SSH keys (generate new keys and re-push to all clusters)
 * POST /api/clusters/rotate-ssh-keys
 */
export const rotateSSHKeys = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;

    // Only super_admin can rotate SSH keys
    if (user.role !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Only super administrators can rotate SSH keys'
      });
      return;
    }

    const privateKeyPath = '/root/.ssh/id_rsa';
    const publicKeyPath = '/root/.ssh/id_rsa.pub';
    const backupPrivateKeyPath = '/root/.ssh/id_rsa.backup';
    const backupPublicKeyPath = '/root/.ssh/id_rsa.pub.backup';

    // Backup existing keys if they exist
    if (fs.existsSync(privateKeyPath)) {
      logger.info('Backing up existing SSH keys before rotation');
      execSync(`cp ${privateKeyPath} ${backupPrivateKeyPath}`);
      execSync(`cp ${publicKeyPath} ${backupPublicKeyPath}`);
    }

    // Generate new SSH keys (overwrite existing)
    logger.info('Generating new SSH keys');
    execSync('mkdir -p /root/.ssh && chmod 700 /root/.ssh');
    execSync(`ssh-keygen -t rsa -b 4096 -C "nat-backend@multpanel" -f ${privateKeyPath} -N "" -y`);
    execSync(`chmod 600 ${privateKeyPath} && chmod 644 ${publicKeyPath}`);

    // Read newly generated keys
    const newPublicKey = fs.readFileSync(publicKeyPath, 'utf-8').trim();
    const newFingerprint = execSync(`ssh-keygen -lf ${publicKeyPath}`).toString().trim();

    logger.info(`New SSH key generated: ${newFingerprint}`);

    // Get all clusters from database
    const clusters = await prisma.proxmox_clusters.findMany({
      where: {
        status: 'active'
      }
    });

    logger.info(`Found ${clusters.length} active clusters to update`);

    // Push new key to all clusters
    const results: any[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (const cluster of clusters) {
      try {
        // Decrypt password
        const decryptedPassword = decrypt(cluster.password_encrypted);
        const username = cluster.username.split('@')[0];

        // Connect via SSH using password auth (since old key may not work)
        const sshClient = new SSH2Client();

        const pushResult = await new Promise<{ success: boolean; message: string }>((resolve) => {
          const timeout = setTimeout(() => {
            sshClient.end();
            resolve({ success: false, message: 'Connection timeout' });
          }, 15000);

          sshClient.on('ready', () => {
            clearTimeout(timeout);

            const commands = [
              'mkdir -p ~/.ssh',
              'chmod 700 ~/.ssh',
              `echo '${newPublicKey}' >> ~/.ssh/authorized_keys`,
              'chmod 600 ~/.ssh/authorized_keys',
              'sort -u ~/.ssh/authorized_keys -o ~/.ssh/authorized_keys',
              `grep -q '${newPublicKey.split(' ')[1].substring(0, 50)}' ~/.ssh/authorized_keys && echo "SSH_KEY_VERIFIED" || echo "SSH_KEY_NOT_FOUND"`
            ].join(' && ');

            sshClient.exec(commands, (err, stream) => {
              if (err) {
                sshClient.end();
                resolve({ success: false, message: err.message });
                return;
              }

              let output = '';
              stream.on('data', (data: Buffer) => {
                output += data.toString();
              });

              stream.on('close', () => {
                sshClient.end();
                const verified = output.includes('SSH_KEY_VERIFIED');
                resolve({
                  success: verified,
                  message: verified ? 'SSH key pushed and verified' : 'SSH key push failed'
                });
              });
            });
          });

          sshClient.on('error', (err) => {
            clearTimeout(timeout);
            resolve({ success: false, message: err.message });
          });

          sshClient.connect({
            host: cluster.host,
            port: 22,
            username: username,
            password: decryptedPassword,
            readyTimeout: 10000
          });
        });

        results.push({
          clusterId: cluster.id,
          clusterName: cluster.name,
          success: pushResult.success,
          message: pushResult.message
        });

        if (pushResult.success) {
          // Track SSH key configuration          const { trackSSHKeyUsage } = await import('./sshKeyHealthController');          await trackSSHKeyUsage(cluster.id, 'ssh_key', true);
          logger.info(`✅ SSH key pushed to cluster ${cluster.name} (${cluster.id})`);
        } else {
          failureCount++;
          logger.warn(`⚠️ Failed to push SSH key to cluster ${cluster.name} (${cluster.id}): ${pushResult.message}`);
        }

      } catch (error: any) {
        failureCount++;
        results.push({
          clusterId: cluster.id,
          clusterName: cluster.name,
          success: false,
          message: error.message
        });
        logger.error(`❌ Error pushing SSH key to cluster ${cluster.name} (${cluster.id}):`, error);
      }
    }

    // Log rotation activity
    await logSSHKeyActivity(
      user.id,
      null, // Global operation
      'rotate_ssh_keys',
      `SSH keys rotated. Successfully pushed to ${successCount}/${clusters.length} clusters`,
      failureCount === 0 ? 'success' : 'warning',
      {
        newFingerprint: newFingerprint,
        totalClusters: clusters.length,
        successCount: successCount,
        failureCount: failureCount,
        backupKeyPath: backupPrivateKeyPath,
        results: results
      },
      req.ip,
      req.headers['user-agent']
    );

    res.json({
      success: true,
      message: `SSH keys rotated successfully. Pushed to ${successCount}/${clusters.length} clusters.`,
      data: {
        newPublicKey: newPublicKey,
        newFingerprint: newFingerprint,
        totalClusters: clusters.length,
        successCount: successCount,
        failureCount: failureCount,
        results: results,
        backupKeyPath: backupPrivateKeyPath
      }
    });

  } catch (error: any) {
    logger.error('Rotate SSH keys error:', error);

    // Log rotation failure
    await logSSHKeyActivity(
      req.user?.id || null,
      null,
      'rotate_ssh_keys',
      `Failed to rotate SSH keys: ${error.message}`,
      'failed',
      { error: error.message },
      req.ip,
      req.headers['user-agent']
    );

    res.status(500).json({
      success: false,
      message: 'Failed to rotate SSH keys',
      error: error.message
    });
  }
};
