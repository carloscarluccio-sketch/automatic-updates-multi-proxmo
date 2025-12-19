/**
 * Disk Conversion Service
 * Handles VMDK download and conversion to qcow2 for Proxmox
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { NodeSSH } from 'node-ssh';
import logger from '../../utils/logger';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

export interface ConversionOptions {
  esxiHost: string;
  esxiPort: number;
  esxiUsername: string;
  esxiPassword: string;
  vmdkPath: string;
  outputDir: string;
  vmName: string;
}

export interface ConversionResult {
  success: boolean;
  qcow2Path?: string;
  sizeBytes?: number;
  duration?: number;
  message?: string;
}

export class DiskConversionService {
  private ssh: NodeSSH;

  constructor() {
    this.ssh = new NodeSSH();
  }

  /**
   * Download VMDK from ESXi and convert to qcow2
   */
  async convertVMDK(options: ConversionOptions): Promise<ConversionResult> {
    const startTime = Date.now();

    try {
      logger.info(`Starting VMDK conversion for ${options.vmName}`);

      // Step 1: Download VMDK from ESXi
      const vmdkLocalPath = await this.downloadVMDK(options);

      // Step 2: Convert VMDK to qcow2
      const qcow2Path = await this.convertToQcow2(vmdkLocalPath, options.outputDir, options.vmName);

      // Step 3: Cleanup downloaded VMDK
      await this.cleanup(vmdkLocalPath);

      // Step 4: Get qcow2 file size
      const stats = await fs.stat(qcow2Path);

      const duration = Date.now() - startTime;

      logger.info(`VMDK conversion completed in ${duration}ms`);

      return {
        success: true,
        qcow2Path,
        sizeBytes: stats.size,
        duration,
        message: `Successfully converted ${options.vmName}`
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error(`VMDK conversion failed: ${error.message}`);

      return {
        success: false,
        duration,
        message: error.message
      };
    } finally {
      if (this.ssh.isConnected()) {
        this.ssh.dispose();
      }
    }
  }

  /**
   * Download VMDK file from ESXi via SCP
   */
  private async downloadVMDK(options: ConversionOptions): Promise<string> {
    try {
      logger.info(`Connecting to ESXi host ${options.esxiHost} via SSH`);

      await this.ssh.connect({
        host: options.esxiHost,
        port: options.esxiPort,
        username: options.esxiUsername,
        password: options.esxiPassword,
        readyTimeout: 30000
      });

      // Create local temp directory
      const localDir = path.join(options.outputDir, 'temp');
      await fs.mkdir(localDir, { recursive: true });

      // Local path for downloaded VMDK
      const vmdkFileName = path.basename(options.vmdkPath);
      const localPath = path.join(localDir, vmdkFileName);

      logger.info(`Downloading VMDK from ${options.vmdkPath} to ${localPath}`);

      // Download file via SFTP
      await this.ssh.getFile(localPath, options.vmdkPath);

      logger.info(`VMDK download completed: ${localPath}`);

      return localPath;
    } catch (error: any) {
      logger.error(`VMDK download failed: ${error.message}`);
      throw new Error(`Failed to download VMDK: ${error.message}`);
    }
  }

  /**
   * Convert VMDK to qcow2 using qemu-img
   */
  private async convertToQcow2(vmdkPath: string, outputDir: string, vmName: string): Promise<string> {
    try {
      const qcow2Path = path.join(outputDir, `${vmName}.qcow2`);

      logger.info(`Converting VMDK to qcow2: ${qcow2Path}`);

      // Run qemu-img convert
      const command = `qemu-img convert -f vmdk -O qcow2 "${vmdkPath}" "${qcow2Path}"`;

      const { stderr } = await execAsync(command);

      if (stderr && !stderr.includes('warning')) {
        logger.warn(`qemu-img warnings: ${stderr}`);
      }

      logger.info(`Conversion completed: ${qcow2Path}`);

      return qcow2Path;
    } catch (error: any) {
      logger.error(`qcow2 conversion failed: ${error.message}`);
      throw new Error(`Failed to convert VMDK to qcow2: ${error.message}`);
    }
  }

  /**
   * Cleanup temporary files
   */
  private async cleanup(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      logger.info(`Cleaned up temporary file: ${filePath}`);

      // Try to remove parent directory if empty
      const parentDir = path.dirname(filePath);
      try {
        await fs.rmdir(parentDir);
        logger.info(`Removed temporary directory: ${parentDir}`);
      } catch {
        // Directory not empty or doesn't exist, ignore
      }
    } catch (error: any) {
      logger.warn(`Cleanup failed: ${error.message}`);
    }
  }

  /**
   * Upload qcow2 to Proxmox storage
   */
  async uploadToProxmox(
    qcow2Path: string,
    proxmoxHost: string,
    proxmoxUsername: string,
    proxmoxPassword: string,
    storagePath: string
  ): Promise<boolean> {
    const ssh = new NodeSSH();

    try {
      logger.info(`Uploading qcow2 to Proxmox: ${proxmoxHost}`);

      await ssh.connect({
        host: proxmoxHost,
        port: 22,
        username: proxmoxUsername,
        password: proxmoxPassword,
        readyTimeout: 30000
      });

      const fileName = path.basename(qcow2Path);
      const remotePath = path.join(storagePath, fileName);

      await ssh.putFile(qcow2Path, remotePath);

      logger.info(`Upload completed: ${remotePath}`);

      return true;
    } catch (error: any) {
      logger.error(`Proxmox upload failed: ${error.message}`);
      throw new Error(`Failed to upload to Proxmox: ${error.message}`);
    } finally {
      if (ssh.isConnected()) {
        ssh.dispose();
      }
    }
  }
}
