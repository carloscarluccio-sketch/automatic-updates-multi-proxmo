import prisma from '../config/database';
import logger from '../utils/logger';
import { trackSSHKeyUsage } from '../controllers/sshKeyHealthController';

export interface NATMetric {
  nat_rule_id?: number;
  cluster_id: number;
  deployment_type: 'create' | 'update' | 'delete' | 'test';
  auth_method: 'ssh_key' | 'password';
  deployment_duration_ms: number;
  success: boolean;
  error_message?: string;
  commands_executed?: number;
  deployed_by?: number;
}

export async function trackNATDeploymentMetric(metric: NATMetric): Promise<void> {
  try {
    await prisma.nat_deployment_metrics.create({
      data: {
        nat_rule_id: metric.nat_rule_id || null,
        cluster_id: metric.cluster_id,
        deployment_type: metric.deployment_type,
        auth_method: metric.auth_method,
        deployment_duration_ms: metric.deployment_duration_ms,
        success: metric.success,
        error_message: metric.error_message || null,
        commands_executed: metric.commands_executed || 1,
        deployed_by: metric.deployed_by || null
      }
    });
    await trackSSHKeyUsage(metric.cluster_id, metric.auth_method, metric.success);
    logger.debug(`NAT metric tracked: ${metric.deployment_type} on cluster ${metric.cluster_id} using ${metric.auth_method}`);
  } catch (error) {
    logger.error('Failed to track NAT deployment metric:', error);
  }
}

export async function getNATPerformanceStats(clusterId?: number): Promise<any> {
  try {
    const where = clusterId ? { cluster_id: clusterId } : {};
    const totalDeployments = await prisma.nat_deployment_metrics.count({ where });
    const successfulDeployments = await prisma.nat_deployment_metrics.count({ where: { ...where, success: true } });
    const failedDeployments = await prisma.nat_deployment_metrics.count({ where: { ...where, success: false } });
    const sshKeyMetrics = await prisma.nat_deployment_metrics.aggregate({ where: { ...where, auth_method: 'ssh_key', success: true }, _avg: { deployment_duration_ms: true }, _count: true });
    const passwordMetrics = await prisma.nat_deployment_metrics.aggregate({ where: { ...where, auth_method: 'password', success: true }, _avg: { deployment_duration_ms: true }, _count: true });
    const sshAvg = sshKeyMetrics._avg?.deployment_duration_ms || 0;
    const passwordAvg = passwordMetrics._avg?.deployment_duration_ms || 0;
    let performanceImprovement = 0;
    if (passwordAvg > 0 && sshAvg > 0) {
      performanceImprovement = ((passwordAvg - sshAvg) / passwordAvg) * 100;
    }
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentDeployments = await prisma.nat_deployment_metrics.findMany({ where: { ...where, deployed_at: { gte: sevenDaysAgo } }, orderBy: { deployed_at: 'desc' }, take: 50, include: { proxmox_clusters: { select: { id: true, name: true } } } });
    return {
      overall: { totalDeployments, successfulDeployments, failedDeployments, successRate: totalDeployments > 0 ? (successfulDeployments / totalDeployments) * 100 : 0 },
      authMethodStats: { sshKey: { count: sshKeyMetrics._count || 0, averageDurationMs: Math.round(sshAvg), averageDurationSeconds: (sshAvg / 1000).toFixed(2) }, password: { count: passwordMetrics._count || 0, averageDurationMs: Math.round(passwordAvg), averageDurationSeconds: (passwordAvg / 1000).toFixed(2) }, performanceImprovement: { percentage: Math.round(performanceImprovement), timeSavedMs: Math.round(passwordAvg - sshAvg), message: performanceImprovement > 0 ? `SSH key auth is ${Math.round(performanceImprovement)}% faster` : 'Insufficient data for comparison' } },
      recentDeployments: recentDeployments.map(d => ({ id: d.id, cluster: d.proxmox_clusters, deploymentType: d.deployment_type, authMethod: d.auth_method, durationMs: d.deployment_duration_ms, durationSeconds: (d.deployment_duration_ms / 1000).toFixed(2), success: d.success, deployedAt: d.deployed_at }))
    };
  } catch (error) {
    logger.error('Failed to get NAT performance stats:', error);
    throw error;
  }
}
