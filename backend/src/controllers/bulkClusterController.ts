import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../config/database';
import { executeSSHCommandWithFallback } from '../utils/ssh';
import { trackSSHKeyUsage } from './sshKeyHealthController';

/**
 * Test connections to multiple clusters simultaneously
 */
export const bulkTestConnection = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { cluster_ids } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    if (!cluster_ids || !Array.isArray(cluster_ids) || cluster_ids.length === 0) {
      res.status(400).json({ success: false, message: 'cluster_ids array is required' });
      return;
    }

    const startTime = Date.now();

    // Fetch all specified clusters with full details
    const clusters = await prisma.proxmox_clusters.findMany({
      where: {
        id: { in: cluster_ids },
        status: 'active'
      }
    });

    if (clusters.length === 0) {
      res.status(404).json({ success: false, message: 'No active clusters found' });
      return;
    }

    // Test each cluster in parallel
    const results = await Promise.allSettled(
      clusters.map(async (cluster: any) => {
        try {
          const result = await executeSSHCommandWithFallback(
            cluster.host,
            cluster.port || 22,
            cluster.username,
            cluster.password_encrypted,
            'echo "Connection test successful"'
          );

          // Track SSH key usage
          const authMethod = result.authMethod === 'ssh-key' ? 'ssh_key' : 'password';
          await trackSSHKeyUsage(cluster.id, authMethod as 'ssh_key' | 'password', result.success);

          return {
            cluster_id: cluster.id,
            cluster_name: cluster.name,
            success: result.success,
            message: result.success ? 'Connection successful' : (result.error || 'Connection failed'),
            auth_method: result.authMethod,
            exit_code: result.exitCode
          };
        } catch (error: any) {
          return {
            cluster_id: cluster.id,
            cluster_name: cluster.name,
            success: false,
            message: error.message || 'Connection failed',
            auth_method: 'unknown',
            exit_code: -1
          };
        }
      })
    );

    // Parse results
    const finalResults = results.map((result: any) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          cluster_id: 0,
          cluster_name: 'Unknown',
          success: false,
          message: 'Operation failed',
          auth_method: 'unknown',
          exit_code: -1
        };
      }
    });

    const successCount = finalResults.filter((r: any) => r.success).length;
    const failureCount = finalResults.filter((r: any) => !r.success).length;
    const durationSeconds = Math.round((Date.now() - startTime) / 1000);

    // Log bulk operation
    await prisma.bulk_cluster_operations.create({
      data: {
        operation_type: 'test_connection',
        cluster_ids: JSON.stringify(cluster_ids),
        total_clusters: clusters.length,
        success_count: successCount,
        failure_count: failureCount,
        results: JSON.stringify(finalResults),
        duration_seconds: durationSeconds,
        initiated_by: userId,
        status: 'completed'
      }
    });

    res.json({
      success: true,
      data: {
        total: clusters.length,
        successful: successCount,
        failed: failureCount,
        duration_seconds: durationSeconds,
        results: finalResults
      }
    });
  } catch (error: any) {
    console.error('Bulk test connection error:', error);
    res.status(500).json({ success: false, message: 'Failed to test connections' });
  }
};

/**
 * Push SSH keys to multiple clusters simultaneously
 */
export const bulkPushSSHKeys = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { cluster_ids } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    if (!cluster_ids || !Array.isArray(cluster_ids) || cluster_ids.length === 0) {
      res.status(400).json({ success: false, message: 'cluster_ids array is required' });
      return;
    }

    const startTime = Date.now();

    // Fetch SSH key
    const sshKey = await prisma.ssh_keys.findFirst({
      where: { status: 'active' },
      orderBy: { generated_at: 'desc' }
    });

    if (!sshKey) {
      res.status(404).json({ success: false, message: 'No active SSH key found' });
      return;
    }

    // Fetch clusters with full details
    const clusters = await prisma.proxmox_clusters.findMany({
      where: {
        id: { in: cluster_ids },
        status: 'active'
      }
    });

    if (clusters.length === 0) {
      res.status(404).json({ success: false, message: 'No active clusters found' });
      return;
    }

    // Push SSH key to each cluster in parallel
    const results = await Promise.allSettled(
      clusters.map(async (cluster: any) => {
        try {
          // Create authorized_keys command
          const publicKey = sshKey.public_key.trim();
          const command = `mkdir -p ~/.ssh && echo "${publicKey}" >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys`;

          const result = await executeSSHCommandWithFallback(
            cluster.host,
            cluster.port || 22,
            cluster.username,
            cluster.password_encrypted,
            command
          );

          // Track SSH key usage
          const authMethod = result.authMethod === 'ssh-key' ? 'ssh_key' : 'password';
          await trackSSHKeyUsage(cluster.id, authMethod as 'ssh_key' | 'password', result.success);

          // Update ssh_key_cluster_status
          if (result.success) {
            await prisma.ssh_key_cluster_status.upsert({
              where: {
                ssh_key_id_cluster_id: {
                  ssh_key_id: sshKey.id,
                  cluster_id: cluster.id
                }
              },
              update: {
                is_configured: true,
                last_push_at: new Date(),
                push_count: { increment: 1 }
              },
              create: {
                ssh_key_id: sshKey.id,
                cluster_id: cluster.id,
                is_configured: true,
                last_push_at: new Date(),
                push_count: 1
              }
            });
          }

          return {
            cluster_id: cluster.id,
            cluster_name: cluster.name,
            success: result.success,
            message: result.success ? 'SSH key pushed successfully' : (result.error || 'Failed to push SSH key'),
            auth_method: result.authMethod
          };
        } catch (error: any) {
          return {
            cluster_id: cluster.id,
            cluster_name: cluster.name,
            success: false,
            message: error.message || 'Failed to push SSH key',
            auth_method: 'unknown'
          };
        }
      })
    );

    // Parse results
    const finalResults = results.map((result: any) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          cluster_id: 0,
          cluster_name: 'Unknown',
          success: false,
          message: 'Operation failed',
          auth_method: 'unknown'
        };
      }
    });

    const successCount = finalResults.filter((r: any) => r.success).length;
    const failureCount = finalResults.filter((r: any) => !r.success).length;
    const durationSeconds = Math.round((Date.now() - startTime) / 1000);

    // Log bulk operation
    await prisma.bulk_cluster_operations.create({
      data: {
        operation_type: 'push_ssh_keys',
        cluster_ids: JSON.stringify(cluster_ids),
        total_clusters: clusters.length,
        success_count: successCount,
        failure_count: failureCount,
        results: JSON.stringify(finalResults),
        duration_seconds: durationSeconds,
        initiated_by: userId,
        status: 'completed'
      }
    });

    res.json({
      success: true,
      data: {
        total: clusters.length,
        successful: successCount,
        failed: failureCount,
        duration_seconds: durationSeconds,
        results: finalResults
      }
    });
  } catch (error: any) {
    console.error('Bulk push SSH keys error:', error);
    res.status(500).json({ success: false, message: 'Failed to push SSH keys' });
  }
};

/**
 * Get bulk operation history
 */
export const getBulkOperationHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;

    const operations = await prisma.bulk_cluster_operations.findMany({
      orderBy: { started_at: 'desc' },
      take: limit
    });

    res.json({
      success: true,
      data: operations.map((op: any) => ({
        id: op.id,
        operation_type: op.operation_type,
        cluster_ids: JSON.parse(op.cluster_ids || '[]'),
        total_clusters: op.total_clusters,
        success_count: op.success_count,
        failure_count: op.failure_count,
        results: JSON.parse(op.results || '[]'),
        started_at: op.started_at,
        completed_at: op.completed_at,
        duration_seconds: op.duration_seconds,
        initiated_by: op.initiated_by,
        status: op.status
      }))
    });
  } catch (error: any) {
    console.error('Get bulk operation history error:', error);
    res.status(500).json({ success: false, message: 'Failed to get operation history' });
  }
};
