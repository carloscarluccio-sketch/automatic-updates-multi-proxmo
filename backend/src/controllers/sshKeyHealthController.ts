import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middlewares/auth';
import logger from '../utils/logger';
import fs from 'fs';
import { execSync } from 'child_process';

export const getSSHKeyHealth = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    if (user.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Only super administrators can view SSH key health' });
      return;
    }
    const publicKeyPath = '/root/.ssh/id_rsa.pub';
    if (!fs.existsSync(publicKeyPath)) {
      res.json({ success: true, data: { keysGenerated: false, warning: 'SSH keys not found' } });
      return;
    }
    const publicKey = fs.readFileSync(publicKeyPath, 'utf-8').trim();
    const fingerprintOutput = execSync(`ssh-keygen -lf ${publicKeyPath}`).toString().trim();
    const fingerprint = fingerprintOutput.split(' ')[1];
    let sshKeyRecord = await prisma.ssh_keys.findUnique({ where: { fingerprint } });
    if (!sshKeyRecord) {
      sshKeyRecord = await prisma.ssh_keys.create({ data: { key_type: 'rsa', key_size: 4096, public_key: publicKey, fingerprint, generated_at: new Date(), status: 'active', created_by: user.id } });
    }
    const totalClusters = await prisma.proxmox_clusters.count({ where: { status: 'active' } });
    const clusterStatuses = await prisma.ssh_key_cluster_status.findMany({ where: { ssh_key_id: sshKeyRecord.id } });
    const configuredClusters = clusterStatuses.filter(s => s.is_configured).length;
    const workingClusters = clusterStatuses.filter(s => s.is_configured && s.last_test_success === true).length;
    const generatedDate = sshKeyRecord.generated_at ? new Date(sshKeyRecord.generated_at) : new Date();
    const daysSinceGeneration = Math.floor((Date.now() - generatedDate.getTime()) / (1000 * 60 * 60 * 24));
    let daysUntilExpiration: number | null = null;
    let expirationWarning = false;
    if (sshKeyRecord.expires_at) {
      const expiresDate = new Date(sshKeyRecord.expires_at);
      daysUntilExpiration = Math.floor((expiresDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiration < 30) { expirationWarning = true; }
    }
    let healthStatus: 'excellent' | 'good' | 'warning' | 'critical' = 'excellent';
    if (expirationWarning || daysSinceGeneration > 90) { healthStatus = 'warning'; }
    if (sshKeyRecord.status === 'expired' || (daysUntilExpiration !== null && daysUntilExpiration <= 0)) { healthStatus = 'critical'; }
    else if (workingClusters < totalClusters * 0.8) { healthStatus = 'warning'; }
    else if (workingClusters === totalClusters) { healthStatus = 'excellent'; }
    else { healthStatus = 'good'; }
    res.json({ success: true, data: { keysGenerated: true, fingerprint, keyAge: { days: daysSinceGeneration, generatedAt: sshKeyRecord.generated_at, lastRotatedAt: sshKeyRecord.last_rotated_at, rotationCount: sshKeyRecord.rotation_count }, expiration: { expiresAt: sshKeyRecord.expires_at, daysUntilExpiration, hasExpiration: sshKeyRecord.expires_at !== null, isExpired: sshKeyRecord.status === 'expired' }, clusters: { total: totalClusters, configured: configuredClusters, working: workingClusters, notConfigured: totalClusters - configuredClusters, configurationRate: totalClusters > 0 ? (configuredClusters / totalClusters) * 100 : 0 }, health: { status: healthStatus, warnings: [ ...(expirationWarning ? [`SSH key expires in ${daysUntilExpiration} days`] : []), ...(daysSinceGeneration > 90 ? [`SSH key is ${daysSinceGeneration} days old`] : []), ...(workingClusters < totalClusters ? [`${totalClusters - workingClusters} clusters not using SSH key`] : []) ] }, lastUsed: sshKeyRecord.last_used_at } });
  } catch (error: any) {
    logger.error('Get SSH key health error:', error);
    res.status(500).json({ success: false, message: 'Failed to get SSH key health', error: error.message });
  }
};

export const setSSHKeyExpiration = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    if (user.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Only super administrators can set SSH key expiration' });
      return;
    }
    const { expirationDays } = req.body;
    if (!expirationDays || typeof expirationDays !== 'number' || expirationDays < 1) {
      res.status(400).json({ success: false, message: 'Invalid expiration days' });
      return;
    }
    const publicKeyPath = '/root/.ssh/id_rsa.pub';
    if (!fs.existsSync(publicKeyPath)) {
      res.status(404).json({ success: false, message: 'SSH keys not found' });
      return;
    }
    const fingerprintOutput = execSync(`ssh-keygen -lf ${publicKeyPath}`).toString().trim();
    const fingerprint = fingerprintOutput.split(' ')[1];
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expirationDays);
    await prisma.ssh_keys.upsert({ where: { fingerprint }, update: { expires_at: expiresAt }, create: { key_type: 'rsa', key_size: 4096, public_key: fs.readFileSync(publicKeyPath, 'utf-8').trim(), fingerprint, generated_at: new Date(), expires_at: expiresAt, status: 'active', created_by: user.id } });
    res.json({ success: true, data: { fingerprint, expiresAt, expirationDays } });
  } catch (error: any) {
    logger.error('Set SSH key expiration error:', error);
    res.status(500).json({ success: false, message: 'Failed to set expiration', error: error.message });
  }
};

export const getSSHKeyClusterDetails = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    if (user.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Only super administrators can view cluster details' });
      return;
    }
    const publicKeyPath = '/root/.ssh/id_rsa.pub';
    if (!fs.existsSync(publicKeyPath)) {
      res.status(404).json({ success: false, message: 'SSH keys not found on backend' });
      return;
    }
    const fingerprintOutput = execSync(`ssh-keygen -lf ${publicKeyPath}`).toString().trim();
    const fingerprint = fingerprintOutput.split(' ')[1];
    const sshKeyRecord = await prisma.ssh_keys.findUnique({ where: { fingerprint } });
    if (!sshKeyRecord) {
      res.status(404).json({ success: false, message: 'SSH key record not found in database' });
      return;
    }
    const clusters = await prisma.proxmox_clusters.findMany({ where: { status: 'active' }, select: { id: true, name: true, host: true, location: true, status: true } });
    const clusterStatuses = await prisma.ssh_key_cluster_status.findMany({ where: { ssh_key_id: sshKeyRecord.id } });
    const statusMap = new Map(clusterStatuses.map(s => [s.cluster_id, s]));
    const clusterDetails = clusters.map(cluster => {
      const status = statusMap.get(cluster.id);
      return { ...cluster, sshKeyStatus: { isConfigured: status?.is_configured || false, lastTested: status?.last_tested_at || null, lastTestSuccess: status?.last_test_success || null, lastPushed: status?.last_push_at || null, pushCount: status?.push_count || 0, authMethodLastUsed: status?.auth_method_last_used || 'unknown', lastAuth: status?.last_auth_at || null } };
    });
    res.json({ success: true, data: { fingerprint, clusters: clusterDetails } });
  } catch (error: any) {
    logger.error('Get SSH key cluster details error:', error);
    res.status(500).json({ success: false, message: 'Failed to get cluster details', error: error.message });
  }
};

export async function trackSSHKeyUsage(clusterId: number, authMethod: 'ssh_key' | 'password', success: boolean): Promise<void> {
  try {
    const publicKeyPath = '/root/.ssh/id_rsa.pub';
    if (!fs.existsSync(publicKeyPath)) {return;}
    const fingerprintOutput = execSync(`ssh-keygen -lf ${publicKeyPath}`).toString().trim();
    const fingerprint = fingerprintOutput.split(' ')[1];
    let sshKeyRecord = await prisma.ssh_keys.findUnique({ where: { fingerprint } });
    if (!sshKeyRecord) {
      const publicKey = fs.readFileSync(publicKeyPath, 'utf-8').trim();
      sshKeyRecord = await prisma.ssh_keys.create({ data: { key_type: 'rsa', key_size: 4096, public_key: publicKey, fingerprint, generated_at: new Date(), status: 'active' } });
    }
    if (authMethod === 'ssh_key' && success) {
      await prisma.ssh_keys.update({ where: { id: sshKeyRecord.id }, data: { last_used_at: new Date() } });
    }
    const existing = await prisma.ssh_key_cluster_status.findFirst({ where: { ssh_key_id: sshKeyRecord.id, cluster_id: clusterId } });
    if (existing) {
      await prisma.ssh_key_cluster_status.update({
        where: { id: existing.id },
        data: {
          is_configured: authMethod === 'ssh_key' && success ? true : existing.is_configured,
          last_tested_at: new Date(),
          last_test_success: success,
          auth_method_last_used: authMethod,
          last_auth_at: new Date()
        }
      });
    } else {
      await prisma.ssh_key_cluster_status.create({ data: { ssh_key_id: sshKeyRecord.id, cluster_id: clusterId, is_configured: authMethod === 'ssh_key' && success, last_tested_at: new Date(), last_test_success: success, auth_method_last_used: authMethod, last_auth_at: new Date() } });
    }
  } catch (error) {
    logger.error('Track SSH key usage error:', error);
  }
}
