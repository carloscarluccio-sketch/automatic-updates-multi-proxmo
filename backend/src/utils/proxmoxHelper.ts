import { ProxmoxAPI } from './proxmoxApi';
import { decrypt } from './encryption';
import logger from './logger';

interface ProxmoxActionParams {
  clusterId: number;
  clusterHost: string;
  clusterPort: number;
  clusterUsername: string;
  clusterPassword: string; // encrypted
  vmid: number;
  node: string;
  action: 'start' | 'stop' | 'restart' | 'delete' | 'shutdown' | 'reboot';
}

interface ProxmoxActionResult {
  success: boolean;
  message: string;
  error?: string;
}

export async function executeProxmoxAction(params: ProxmoxActionParams): Promise<ProxmoxActionResult> {
  try {
    // Decrypt password
    const decryptedPassword = decrypt(params.clusterPassword);

    // Create Proxmox API client
    const proxmox = new ProxmoxAPI(
      {
        host: params.clusterHost,
        port: params.clusterPort,
        username: params.clusterUsername
      },
      decryptedPassword
    );

    // Ensure authentication
    await proxmox.ensureAuthenticated();

    // Execute action
    switch (params.action) {
      case 'start':
        await proxmox.startVM(params.node, params.vmid);
        logger.info(`Started VM ${params.vmid} on node ${params.node}`);
        return { success: true, message: `VM ${params.vmid} started successfully` };

      case 'stop':
        await proxmox.stopVM(params.node, params.vmid);
        logger.info(`Stopped VM ${params.vmid} on node ${params.node}`);
        return { success: true, message: `VM ${params.vmid} stopped successfully` };

      case 'shutdown':
        await proxmox.shutdownVM(params.node, params.vmid);
        logger.info(`Shutdown VM ${params.vmid} on node ${params.node}`);
        return { success: true, message: `VM ${params.vmid} shutdown successfully` };

      case 'restart':
      case 'reboot':
        await proxmox.rebootVM(params.node, params.vmid);
        logger.info(`Rebooted VM ${params.vmid} on node ${params.node}`);
        return { success: true, message: `VM ${params.vmid} rebooted successfully` };

      case 'delete':
        await proxmox.deleteVM(params.node, params.vmid, true);
        logger.info(`Deleted VM ${params.vmid} on node ${params.node}`);
        return { success: true, message: `VM ${params.vmid} deleted successfully` };

      default:
        return { success: false, message: `Unknown action: ${params.action}`, error: 'Invalid action' };
    }
  } catch (error: any) {
    logger.error(`Proxmox action ${params.action} failed for VM ${params.vmid}:`, error);
    return {
      success: false,
      message: `Failed to ${params.action} VM ${params.vmid}`,
      error: error.message || 'Unknown error'
    };
  }
}
