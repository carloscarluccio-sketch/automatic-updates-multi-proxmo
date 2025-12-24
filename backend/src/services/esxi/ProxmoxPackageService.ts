import { PrismaClient } from '@prisma/client';
import logger from '../../utils/logger';
import { executeSSHCommand } from '../../utils/ssh';
import { decrypt } from '../../utils/encryption';

const prisma = new PrismaClient();

export interface PackageStatus {
  installed: boolean;
  version?: string;
  available_version?: string;
}

export interface InstallationProgress {
  status: 'checking' | 'installing' | 'completed' | 'failed';
  message: string;
  progress_percent: number;
}

export class ProxmoxPackageService {
  private clusterId: number;

  constructor(clusterId: number) {
    this.clusterId = clusterId;
  }

  /**
   * Check if pve-esxi-import-tools is installed on the Proxmox cluster
   */
  async checkESXiImportTools(): Promise<PackageStatus> {
    try {
      logger.info(`Checking pve-esxi-import-tools on cluster ${this.clusterId}`);

      const cluster = await prisma.proxmox_clusters.findUnique({
        where: { id: this.clusterId }
      });

      if (!cluster) {
        throw new Error(`Cluster ${this.clusterId} not found`);
      }

      const password = decrypt(cluster.password_encrypted);

      // Check if package is installed
      const checkCmd = 'dpkg -l | grep pve-esxi-import-tools || echo "NOT_INSTALLED"';
      const checkResult = await executeSSHCommand(
        cluster.host,
        22,
        'root',
        password,
        checkCmd
      );

      if (!checkResult.output || checkResult.output.includes('NOT_INSTALLED') || checkResult.exitCode !== 0) {
        // Check if package is available in repos
        const availCmd = 'apt-cache policy pve-esxi-import-tools 2>/dev/null || echo "NOT_AVAILABLE"';
        const availResult = await executeSSHCommand(
          cluster.host,
          22,
          'root',
          password,
          availCmd
        );

        const availableVersion = this.parseAvailableVersion(availResult.output || "");

        return {
          installed: false,
          available_version: availableVersion
        };
      }

      // Parse installed version
      const version = this.parseInstalledVersion(checkResult.output || "");

      return {
        installed: true,
        version: version
      };
    } catch (error: any) {
      logger.error('Failed to check pve-esxi-import-tools:', error);
      throw new Error(`Failed to check package status: ${error.message}`);
    }
  }

  /**
   * Install pve-esxi-import-tools on the Proxmox cluster
   */
  async installESXiImportTools(): Promise<InstallationProgress> {
    try {
      logger.info(`Installing pve-esxi-import-tools on cluster ${this.clusterId}`);

      const cluster = await prisma.proxmox_clusters.findUnique({
        where: { id: this.clusterId }
      });

      if (!cluster) {
        throw new Error(`Cluster ${this.clusterId} not found`);
      }

      const password = decrypt(cluster.password_encrypted);

      // Update package lists first
      logger.info('Updating package lists...');
      const updateCmd = 'apt-get update 2>&1';
      const updateResult = await executeSSHCommand(
        cluster.host,
        22,
        'root',
        password,
        updateCmd,
        120000 // 2 minute timeout
      );

      if (updateResult.exitCode !== 0) {
        throw new Error(`Failed to update package lists: ${updateResult.error}`);
      }

      // Install the package
      logger.info('Installing pve-esxi-import-tools...');
      const installCmd = 'DEBIAN_FRONTEND=noninteractive apt-get install -y pve-esxi-import-tools 2>&1';
      const installResult = await executeSSHCommand(
        cluster.host,
        22,
        'root',
        password,
        installCmd,
        300000 // 5 minute timeout
      );

      if (installResult.exitCode !== 0) {
        logger.error('Installation failed:', installResult.error);
        return {
          status: 'failed',
          message: `Installation failed: ${installResult.error || installResult.output}`,
          progress_percent: 0
        };
      }

      // Verify installation
      const verifyResult = await this.checkESXiImportTools();

      if (verifyResult.installed) {
        logger.info(`pve-esxi-import-tools installed successfully: version ${verifyResult.version}`);
        return {
          status: 'completed',
          message: `Successfully installed pve-esxi-import-tools version ${verifyResult.version}`,
          progress_percent: 100
        };
      } else {
        throw new Error('Installation completed but package verification failed');
      }
    } catch (error: any) {
      logger.error('Failed to install pve-esxi-import-tools:', error);
      return {
        status: 'failed',
        message: error.message,
        progress_percent: 0
      };
    }
  }

  private parseInstalledVersion(output: string): string {
    // dpkg -l output format: ii  pve-esxi-import-tools  8.0.1-1  all  ...
    const match = output.match(/pve-esxi-import-tools\s+(\S+)/);
    return match ? match[1] : 'unknown';
  }

  private parseAvailableVersion(output: string): string | undefined {
    if (output.includes('NOT_AVAILABLE')) {
      return undefined;
    }

    // apt-cache policy output: Candidate: 8.0.1-1
    const match = output.match(/Candidate:\s+(\S+)/);
    return match ? match[1] : undefined;
  }
}

export default ProxmoxPackageService;
