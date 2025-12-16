import { trackConsoleActivity } from '../middlewares/vmActivityMiddleware';
/**
 * Proxmox Console Proxy
 *
 * This module provides WebSocket proxying for Proxmox noVNC consoles
 * through the control panel backend, eliminating the need to expose
 * Proxmox cluster IPs directly to end users.
 *
 * Features:
 * - Proxies console WebSocket connections
 * - Works over internal VPN network
 * - Authenticates users before establishing proxy
 * - Logs console access
 * - Supports multiple concurrent connections
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { parse } from 'url';
import prisma from '../config/database';
import logger from '../utils/logger';
import { decrypt } from '../utils/encryption';
import https from 'https';
import { IncomingMessage } from 'http';

interface ProxmoxTicket {
  ticket: string;
  CSRFPreventionToken: string;
}

interface ConsoleProxyOptions {
  server: Server;
  path?: string;
}

/**
 * Get Proxmox authentication ticket
 */
async function getProxmoxTicket(
  host: string,
  port: number,
  username: string,
  password: string
): Promise<ProxmoxTicket> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      username,
      password
    });

    const options = {
      hostname: host,
      port: port,
      path: '/api2/json/access/ticket',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      },
      rejectUnauthorized: false // Accept self-signed certificates
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          if (response.data) {
            resolve({
              ticket: response.data.ticket,
              CSRFPreventionToken: response.data.CSRFPreventionToken
            });
          } else {
            reject(new Error('Failed to get Proxmox ticket'));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/**
 * Get noVNC WebSocket path for VM
 */
async function getVNCWebSocketPath(
  host: string,
  port: number,
  node: string,
  vmid: number,
  ticket: ProxmoxTicket
): Promise<{ wsPath: string; vncTicket: string }> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: host,
      port: port,
      path: `/api2/json/nodes/${node}/qemu/${vmid}/vncproxy`,
      method: 'POST',
      headers: {
        'Cookie': `PVEAuthCookie=${ticket.ticket}`,
        'CSRFPreventionToken': ticket.CSRFPreventionToken
      },
      rejectUnauthorized: false
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          if (response.data && response.data.port && response.data.ticket) {
            // Construct WebSocket path
            const wsPath = `/api2/json/nodes/${node}/qemu/${vmid}/vncwebsocket?port=${response.data.port}&vncticket=${encodeURIComponent(response.data.ticket)}`;
            // Return both the path and the VNC ticket (needed for VNC auth)
            resolve({ wsPath, vncTicket: response.data.ticket });
          } else {
            reject(new Error('Failed to get VNC proxy info'));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Verify JWT token from query string
 */
function verifyToken(token: string): { userId: number; role: string; companyId: number | null } | null {
  console.log('🔍 [TOKEN] verifyToken function called');
  console.log('🔍 [TOKEN] Token:', token ? `${token.substring(0, 50)}...` : 'NULL');

  try {
    console.log('🔍 [TOKEN] JWT_ACCESS_SECRET exists:', !!process.env.JWT_ACCESS_SECRET);

    logger.info('[CONSOLE PROXY] Attempting to verify token...');
    logger.info('[CONSOLE PROXY] Token length:', token?.length);
    logger.info('[CONSOLE PROXY] JWT_ACCESS_SECRET exists:', !!process.env.JWT_ACCESS_SECRET);

    // Import JWT verification from your auth middleware
    const jwt = require('jsonwebtoken');
    console.log('🔍 [TOKEN] jwt library loaded');

    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) {
      console.error('🔍 [TOKEN] ❌ JWT_ACCESS_SECRET not found in environment!');
      throw new Error('JWT_ACCESS_SECRET not configured');
    }
    console.log('🔍 [TOKEN] Using JWT_ACCESS_SECRET (first 10 chars):', secret.substring(0, 10) + '...');
    logger.info('[CONSOLE PROXY] Using JWT_ACCESS_SECRET');

    console.log('🔍 [TOKEN] About to call jwt.verify...');
    const decoded = jwt.verify(token, secret);
    console.log('🔍 [TOKEN] jwt.verify succeeded! Decoded:', decoded);

    logger.info('[CONSOLE PROXY] ✅ Token decoded successfully:', {
      sub: decoded.sub,
      id: decoded.id,
      iat: decoded.iat,
      exp: decoded.exp
    });

    // JWT uses 'sub' (subject) for user ID, not 'id'
    const userId = decoded.sub || decoded.id;
    console.log('🔍 [TOKEN] Extracted userId:', userId);

    if (!userId) {
      console.log('🔍 [TOKEN] ❌ No user ID found in token');
      logger.error('[CONSOLE PROXY] ❌ No user ID in token');
      return null;
    }

    logger.info('[CONSOLE PROXY] ✅ User ID extracted:', userId);
    console.log('🔍 [TOKEN] ✅ Returning token data');

    return {
      userId: userId,
      role: decoded.role || null,
      companyId: decoded.company_id || decoded.companyId || null
    };
  } catch (error: any) {
    console.error('🔍 [TOKEN] ❌ ERROR in verifyToken:', error);
    console.error('🔍 [TOKEN] Error name:', error.name);
    console.error('🔍 [TOKEN] Error message:', error.message);
    logger.error('[CONSOLE PROXY] ❌ Token verification failed');
    logger.error('[CONSOLE PROXY] Error name:', error.name);
    logger.error('[CONSOLE PROXY] Error message:', error.message);
    logger.error('[CONSOLE PROXY] Full error:', error);
    return null;
  }
}

/**
 * Initialize Console Proxy WebSocket Server
 */
export function initializeConsoleProxy(options: ConsoleProxyOptions): void {
  console.log('🟢 [CONSOLE PROXY] initializeConsoleProxy() called');
  console.log('🟢 [CONSOLE PROXY] options:', { path: options.path, hasServer: !!options.server });

  try {
    console.log('🟢 [CONSOLE PROXY] Creating WebSocketServer...');
    const wss = new WebSocketServer({
      server: options.server,
      path: options.path || '/console-proxy'
    });
    console.log('🟢 [CONSOLE PROXY] WebSocketServer created successfully!');

    logger.info(`✅ Console proxy WebSocket server initialized at ${options.path || '/console-proxy'}`);
    logger.info(`🎯 WebSocket server listening for connections`);

  wss.on('connection', async (clientWs: WebSocket, request: IncomingMessage) => {
    console.log(`🔌 [CONSOLE PROXY] NEW WEBSOCKET CONNECTION RECEIVED!`);
    console.log(`🔌 [CONSOLE PROXY] Request URL: ${request.url}`);
    logger.info(`🔌 [CONSOLE PROXY] NEW WEBSOCKET CONNECTION RECEIVED!`);
    logger.info(`🔌 [CONSOLE PROXY] Request URL: ${request.url}`);

    const { query } = parse(request.url || '', true);
    const vmId = parseInt(query.vmId as string);
    const token = query.token as string;

    console.log(`🔌 [CONSOLE PROXY] VM ID: ${vmId}, Token length: ${token?.length || 0}`);
    logger.info(`🔌 [CONSOLE PROXY] Connection request for VM ID: ${vmId}`);
    logger.info(`🔌 [CONSOLE PROXY] Token received:`, token ? `${token.substring(0, 30)}...` : 'NONE');

    // Verify token and extract user ID
    console.log(`🔌 [CONSOLE PROXY] Verifying token...`);
    const tokenData = verifyToken(token);
    console.log(`🔌 [CONSOLE PROXY] Token verification result:`, tokenData ? 'SUCCESS' : 'FAILED');
    if (!tokenData) {
      console.log('[CONSOLE PROXY] ❌ Invalid token, closing connection');
      logger.error('[CONSOLE PROXY] Invalid token');
      clientWs.close(1008, 'Invalid authentication token');
      return;
    }

    try {
      // Fetch user from database to get role and company_id
      console.log(`🔍 [DB] Fetching user ${tokenData.userId} from database`);
      logger.info(`[CONSOLE PROXY] Fetching user ${tokenData.userId} from database`);
      const user = await prisma.users.findUnique({
        where: { id: tokenData.userId },
        select: {
          id: true,
          role: true,
          company_id: true,
          username: true
        }
      });

      if (!user) {
        console.log('🔍 [DB] ❌ User not found in database');
        logger.error('[CONSOLE PROXY] User not found in database');
        clientWs.close(1008, 'User not found');
        return;
      }

      console.log(`🔍 [DB] ✅ User authenticated:`, user.username, 'Role:', user.role, 'Company:', user.company_id);
      logger.info(`[CONSOLE PROXY] User authenticated:`, {
        id: user.id,
        username: user.username,
        role: user.role,
        company_id: user.company_id
      });

      // Get VM details
      console.log(`🔍 [DB] Fetching VM ${vmId} from database`);
      const vm = await prisma.virtual_machines.findUnique({
        where: { id: vmId },
        include: {
          proxmox_clusters: true
        }
      });

      if (!vm) {
        console.log('🔍 [DB] ❌ VM not found');
        logger.error('[CONSOLE PROXY] VM not found');
        clientWs.close(1008, 'VM not found');
        return;
      }

      console.log(`🔍 [DB] ✅ VM found:`, vm.name, 'VMID:', vm.vmid, 'Node:', vm.node, 'Company:', vm.company_id);
      logger.info(`[CONSOLE PROXY] VM found:`, {
        id: vm.id,
        name: vm.name,
        company_id: vm.company_id
      });

      // Permission check
      console.log(`🔍 [AUTH] Checking permissions - User role: ${user.role}, User company: ${user.company_id}, VM company: ${vm.company_id}`);
      if (user.role !== 'super_admin' && vm.company_id !== user.company_id) {
        console.log('🔍 [AUTH] ❌ Permission denied');
        logger.error('[CONSOLE PROXY] Permission denied - user company:', user.company_id, 'vm company:', vm.company_id);
        clientWs.close(1008, 'Permission denied');
        return;
      }
      console.log('🔍 [AUTH] ✅ Permission granted');

      if (!vm.proxmox_clusters) {
        console.log('🔍 [DB] ❌ Cluster not found for VM');
        logger.error('[CONSOLE PROXY] Cluster not found');
        clientWs.close(1008, 'Cluster not found');
        return;
      }
      console.log('🔍 [DB] ✅ Cluster found:', vm.proxmox_clusters.name);

      const cluster = vm.proxmox_clusters;
      console.log(`🔍 [PROXMOX] Decrypting cluster password...`);
      const decryptedPassword = decrypt(cluster.password_encrypted);

      console.log(`🔍 [PROXMOX] Authenticating with Proxmox cluster: ${cluster.name} (${cluster.host}:${cluster.port || 8006})`);
      logger.info(`[CONSOLE PROXY] Authenticating with Proxmox cluster: ${cluster.name}`);

      const port = cluster.port || 8006;

      // Get Proxmox ticket
      console.log(`🔍 [PROXMOX] Getting Proxmox ticket for user: ${cluster.username}`);
      const ticket = await getProxmoxTicket(
        cluster.host,
        port,
        cluster.username,
        decryptedPassword
      );
      console.log(`🔍 [PROXMOX] ✅ Proxmox ticket obtained`);

      logger.info(`[CONSOLE PROXY] Getting VNC WebSocket path`);

      // Get VNC WebSocket path and ticket
      console.log(`🔍 [PROXMOX] Getting VNC WebSocket path for VM ${vm.vmid} on node ${vm.node}`);
      const vncInfo = await getVNCWebSocketPath(
        cluster.host,
        port,
        vm.node,
        vm.vmid,
        ticket
      );
      console.log(`🔍 [PROXMOX] ✅ VNC path obtained: ${vncInfo.wsPath}`);
      console.log(`🔍 [PROXMOX] ✅ VNC ticket obtained (length: ${vncInfo.vncTicket.length})`);

      logger.info(`[CONSOLE PROXY] Establishing proxy connection to ${cluster.host}:${port}${vncInfo.wsPath}`);

      // Send VNC ticket to client as first message (JSON format)
      // Client will use this as the VNC password when noVNC asks for credentials
      console.log(`🔍 [PROXMOX] Sending VNC ticket to client...`);
      clientWs.send(JSON.stringify({
        type: 'vnc-ticket',
        ticket: vncInfo.vncTicket
      }));
      console.log(`🔍 [PROXMOX] ✅ VNC ticket sent to client`);

      // Connect to Proxmox WebSocket
      console.log(`🔍 [PROXMOX] Establishing WebSocket connection to wss://${cluster.host}:${port}${vncInfo.wsPath}`);
      const proxmoxWs = new WebSocket(`wss://${cluster.host}:${port}${vncInfo.wsPath}`, {
        headers: {
          'Cookie': `PVEAuthCookie=${ticket.ticket}`
        },
        rejectUnauthorized: false
      });
      console.log(`🔍 [PROXMOX] WebSocket created, waiting for connection...`);

      // Proxy client -> Proxmox
      clientWs.on('message', (data) => {
        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
        console.log(`📤 [PROXY] Client -> Proxmox: ${buffer.length} bytes`);
        const hexData = buffer.toString('hex').substring(0, 100);
        console.log(`📤 [PROXY] Data (hex): ${hexData}`);

        if (proxmoxWs.readyState === WebSocket.OPEN) {
          proxmoxWs.send(data);
        } else {
          console.log(`⚠️ [PROXY] Cannot send - Proxmox WebSocket not open (state: ${proxmoxWs.readyState})`);
        }
      });

      // Proxy Proxmox -> client
      proxmoxWs.on('message', (data) => {
        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
        console.log(`📥 [PROXY] Proxmox -> Client: ${buffer.length} bytes`);
        const hexData = buffer.toString('hex').substring(0, 100);
        console.log(`📥 [PROXY] Data (hex): ${hexData}`);

        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(data);
        } else {
          console.log(`⚠️ [PROXY] Cannot send - Client WebSocket not open (state: ${clientWs.readyState})`);
        }
      });

      // Handle errors
      proxmoxWs.on('error', (error) => {
        console.log('🔴 [PROXMOX] Proxmox WebSocket error:', error);
        logger.error('[CONSOLE PROXY] Proxmox WebSocket error:', error);
        clientWs.close(1011, 'Proxmox connection error');
      });

      clientWs.on('error', (error) => {
        console.log('🔴 [CLIENT] Client WebSocket error:', error);
        logger.error('[CONSOLE PROXY] Client WebSocket error:', error);
        proxmoxWs.close();
      });

      // Handle close
      proxmoxWs.on('close', (code, reason) => {
        console.log(`🔴 [PROXMOX] Proxmox connection closed - Code: ${code}, Reason: ${reason}`);
        logger.info('[CONSOLE PROXY] Proxmox connection closed');
        clientWs.close();
      });

      clientWs.on('close', (code, reason) => {
        console.log(`🔴 [CLIENT] Client connection closed - Code: ${code}, Reason: ${reason}`);
        logger.info('[CONSOLE PROXY] Client connection closed');
        proxmoxWs.close();
      });

      proxmoxWs.on('open', () => {
        // Track console activity for auto-shutdown
        trackConsoleActivity(vmId).catch((err: any) => logger.error("Failed to track console activity:", err));
        console.log(`✅ [PROXMOX] WebSocket connection established successfully!`);
      });

      console.log(`✅ [CONSOLE PROXY] Proxy established for VM ${vm.name} (VMID: ${vm.vmid})`);
      logger.info(`[CONSOLE PROXY] Proxy established for VM ${vm.name} (VMID: ${vm.vmid})`);

    } catch (error: any) {
      console.log('🔴 [ERROR] Error establishing proxy:', error);
      console.log('🔴 [ERROR] Error name:', error.name);
      console.log('🔴 [ERROR] Error message:', error.message);
      console.log('🔴 [ERROR] Error stack:', error.stack);
      logger.error('[CONSOLE PROXY] Error establishing proxy:', error);
      clientWs.close(1011, error.message || 'Failed to establish console connection');
    }
  });

    wss.on('error', (error) => {
      console.log('🔴 [CONSOLE PROXY] WebSocket server error:', error);
      logger.error('[CONSOLE PROXY] WebSocket server error:', error);
    });

    console.log('🟢 [CONSOLE PROXY] All event handlers attached, initialization complete');
  } catch (error: any) {
    console.error('🔴 [CONSOLE PROXY] FATAL ERROR during initialization:', error);
    logger.error('[CONSOLE PROXY] FATAL ERROR:', error);
    throw error;
  }
}
