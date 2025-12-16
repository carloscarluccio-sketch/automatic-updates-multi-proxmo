import { Response } from 'express';
import { AuthRequest } from '../types/express';
import prisma from '../config/database';
import logger from '../utils/logger';
import { exec } from 'child_process';
import { promisify } from 'util';
import { decrypt } from '../utils/encryption';
import fs from 'fs';

const execAsync = promisify(exec);

export const uploadISO = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    const { cluster_id, node, storage } = req.body;

    if (!file) {
      res.status(400).json({ success: false, message: 'No file uploaded' });
      return;
    }

    if (!cluster_id || !node || !storage) {
      // Clean up uploaded file
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      res.status(400).json({ success: false, message: 'Missing cluster_id, node, or storage' });
      return;
    }

    // Get cluster details
    const cluster = await prisma.proxmox_clusters.findUnique({
      where: { id: parseInt(cluster_id) }
    });

    if (!cluster) {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      res.status(404).json({ success: false, message: 'Cluster not found' });
      return;
    }

    const password = decrypt(cluster.password_encrypted);
    const remotePath = `/var/lib/vz/template/iso/${file.originalname}`;

    logger.info(`Uploading ISO ${file.originalname} to ${cluster.host}:${remotePath}`);

    // Upload file via SCP
    const scpCommand = `sshpass -p \'${password}\' scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -P 22 "${file.path}" "${cluster.username.replace('@pam', '')}@${cluster.host}:${remotePath}"`;

    try {
      await execAsync(scpCommand);
      logger.info(`ISO ${file.originalname} uploaded successfully to ${cluster.host}`);

      // Clean up local temp file
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      res.json({
        success: true,
        message: 'ISO uploaded successfully',
        data: {
          filename: file.originalname,
          size: file.size,
          remotePath
        }
      });
    } catch (error: any) {
      logger.error('ISO upload error:', error);
      
      // Clean up local temp file
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      res.status(500).json({
        success: false,
        message: 'Failed to upload ISO to Proxmox',
        error: error.message
      });
    }
  } catch (error: any) {
    logger.error('ISO upload controller error:', error);
    res.status(500).json({ success: false, message: 'Server error during upload' });
  }
};
