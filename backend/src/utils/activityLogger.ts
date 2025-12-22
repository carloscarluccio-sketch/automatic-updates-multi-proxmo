// Activity Logger Utility - Centralized logging for all operations
import prisma from '../config/database';
import logger from './logger';
import { Request } from 'express';

interface ActivityLogParams {
  userId: number;
  companyId?: number | null;
  activityType: string;
  entityType: string;
  entityId?: number | null;
  action: string;
  description: string;
  status?: 'success' | 'failed' | 'in_progress' | 'warning';
  metadata?: Record<string, any>;
  req?: Request;
}

/**
 * Log activity to the database
 */
export const logActivity = async (params: ActivityLogParams): Promise<void> => {
  try {
    await prisma.activity_logs.create({
      data: {
        user_id: params.userId,
        company_id: params.companyId || null,
        activity_type: params.activityType,
        entity_type: params.entityType,
        entity_id: params.entityId || null,
        action: params.action,
        description: params.description,
        status: params.status || 'success',
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        ip_address: params.req?.ip || null,
        user_agent: params.req?.get('user-agent') || null,
      },
    });

    logger.info(`Activity logged: ${params.action} on ${params.entityType} by user ${params.userId}`);
  } catch (error) {
    logger.error('Activity logging error:', error);
    // Don't throw - logging failures shouldn't break the main operation
  }
};

/**
 * Log VM operations
 */
export const logVMActivity = async (
  action: 'create' | 'update' | 'delete' | 'start' | 'stop' | 'restart' | 'snapshot' | 'clone',
  vmId: number,
  vmName: string,
  userId: number,
  companyId: number | null,
  status: 'success' | 'failed' = 'success',
  metadata?: Record<string, any>,
  req?: Request
): Promise<void> => {
  await logActivity({
    userId,
    companyId,
    activityType: 'vm_management',
    entityType: 'virtual_machine',
    entityId: vmId,
    action,
    description: `${action.charAt(0).toUpperCase() + action.slice(1)} VM: ${vmName}`,
    status,
    metadata,
    req,
  });
};

/**
 * Log cluster operations
 */
export const logClusterActivity = async (
  action: 'create' | 'update' | 'delete' | 'test_connection' | 'sync',
  clusterId: number | null,
  clusterName: string,
  userId: number,
  companyId: number | null,
  status: 'success' | 'failed' = 'success',
  metadata?: Record<string, any>,
  req?: Request
): Promise<void> => {
  await logActivity({
    userId,
    companyId,
    activityType: 'infrastructure',
    entityType: 'cluster',
    entityId: clusterId,
    action,
    description: `${action.charAt(0).toUpperCase() + action.slice(1)} cluster: ${clusterName}`,
    status,
    metadata,
    req,
  });
};

/**
 * Log company operations
 */
export const logCompanyActivity = async (
  action: 'create' | 'update' | 'delete' | 'assign_cluster' | 'remove_cluster',
  companyId: number,
  companyName: string,
  userId: number,
  status: 'success' | 'failed' = 'success',
  metadata?: Record<string, any>,
  req?: Request
): Promise<void> => {
  await logActivity({
    userId,
    companyId,
    activityType: 'company_management',
    entityType: 'company',
    entityId: companyId,
    action,
    description: `${action.charAt(0).toUpperCase() + action.slice(1)} company: ${companyName}`,
    status,
    metadata,
    req,
  });
};

/**
 * Log user operations
 */
export const logUserActivity = async (
  action: 'create' | 'update' | 'delete' | 'change_role' | 'reset_password',
  targetUserId: number,
  targetUserEmail: string,
  actingUserId: number,
  companyId: number | null,
  status: 'success' | 'failed' = 'success',
  metadata?: Record<string, any>,
  req?: Request
): Promise<void> => {
  await logActivity({
    userId: actingUserId,
    companyId,
    activityType: 'user_management',
    entityType: 'user',
    entityId: targetUserId,
    action,
    description: `${action.charAt(0).toUpperCase() + action.slice(1)} user: ${targetUserEmail}`,
    status,
    metadata,
    req,
  });
};

/**
 * Log security operations
 */
export const logSecurityActivity = async (
  action: string,
  entityType: 'sso_config' | '2fa' | 'api_token',
  entityId: number | null,
  userId: number,
  companyId: number | null,
  description: string,
  status: 'success' | 'failed' = 'success',
  metadata?: Record<string, any>,
  req?: Request
): Promise<void> => {
  await logActivity({
    userId,
    companyId,
    activityType: 'security',
    entityType,
    entityId,
    action,
    description,
    status,
    metadata,
    req,
  });
};

/**
 * Log configuration changes
 */
export const logConfigActivity = async (
  action: string,
  entityType: 'branding' | 'profile' | 'settings',
  entityId: number | null,
  userId: number,
  companyId: number | null,
  description: string,
  status: 'success' | 'failed' = 'success',
  metadata?: Record<string, any>,
  req?: Request
): Promise<void> => {
  await logActivity({
    userId,
    companyId,
    activityType: 'configuration',
    entityType,
    entityId,
    action,
    description,
    status,
    metadata,
    req,
  });
};

/**
 * Log network operations
 */
export const logNetworkActivity = async (
  action: string,
  entityType: 'ip_range' | 'nat_rule',
  entityId: number | null,
  userId: number,
  companyId: number | null,
  description: string,
  status: 'success' | 'failed' = 'success',
  metadata?: Record<string, any>,
  req?: Request
): Promise<void> => {
  await logActivity({
    userId,
    companyId,
    activityType: 'network_management',
    entityType,
    entityId,
    action,
    description,
    status,
    metadata,
    req,
  });
};

/**
 * Log background job operations
 */
export const logJobActivity = async (
  action: 'queued' | 'started' | 'completed' | 'failed' | 'cancelled',
  jobType: 'iso_scan' | 'template_scan' | 'esxi_import' | 'vm_discovery',
  jobId: string,
  userId: number | null,
  companyId: number | null,
  clusterId: number | null,
  description: string,
  status: 'success' | 'failed' | 'in_progress' | 'warning' = 'success',
  metadata?: Record<string, any>
): Promise<void> => {
  await logActivity({
    userId: userId || 1, // Use system user if no userId provided
    companyId,
    activityType: 'background_job',
    entityType: jobType,
    entityId: clusterId,
    action,
    description,
    status,
    metadata: {
      ...metadata,
      job_id: jobId,
      job_type: jobType
    }
  });
};

/**
 * Log ISO scan operations
 */
export const logISOScanActivity = async (
  action: 'scan_started' | 'scan_completed' | 'scan_failed',
  clusterId: number,
  clusterName: string,
  userId: number | null,
  companyId: number | null,
  status: 'success' | 'failed' | 'in_progress' = 'success',
  metadata?: Record<string, any>
): Promise<void> => {
  const descriptions = {
    scan_started: `Started ISO scan on cluster: ${clusterName}`,
    scan_completed: `Completed ISO scan on cluster: ${clusterName} - Found ${metadata?.iso_count || 0} ISOs`,
    scan_failed: `Failed ISO scan on cluster: ${clusterName} - ${metadata?.error || 'Unknown error'}`
  };

  await logActivity({
    userId: userId || 1,
    companyId,
    activityType: 'cluster_scan',
    entityType: 'cluster',
    entityId: clusterId,
    action,
    description: descriptions[action],
    status,
    metadata: {
      ...metadata,
      scan_type: 'iso'
    }
  });
};

/**
 * Log template scan operations
 */
export const logTemplateScanActivity = async (
  action: 'scan_started' | 'scan_completed' | 'scan_failed',
  clusterId: number,
  clusterName: string,
  userId: number | null,
  companyId: number | null,
  status: 'success' | 'failed' | 'in_progress' = 'success',
  metadata?: Record<string, any>
): Promise<void> => {
  const descriptions = {
    scan_started: `Started template scan on cluster: ${clusterName}`,
    scan_completed: `Completed template scan on cluster: ${clusterName} - Found ${metadata?.template_count || 0} templates`,
    scan_failed: `Failed template scan on cluster: ${clusterName} - ${metadata?.error || 'Unknown error'}`
  };

  await logActivity({
    userId: userId || 1,
    companyId,
    activityType: 'cluster_scan',
    entityType: 'cluster',
    entityId: clusterId,
    action,
    description: descriptions[action],
    status,
    metadata: {
      ...metadata,
      scan_type: 'template'
    }
  });
};

/**
 * Log ESXi import operations
 */
export const logESXiImportActivity = async (
  action: 'import_started' | 'import_completed' | 'import_failed',
  vmName: string,
  esxiHostId: number,
  clusterId: number,
  userId: number | null,
  companyId: number | null,
  status: 'success' | 'failed' | 'in_progress' = 'success',
  metadata?: Record<string, any>
): Promise<void> => {
  const descriptions = {
    import_started: `Started ESXi VM import: ${vmName}`,
    import_completed: `Completed ESXi VM import: ${vmName} - VMID ${metadata?.vmid || 'Unknown'}`,
    import_failed: `Failed ESXi VM import: ${vmName} - ${metadata?.error || 'Unknown error'}`
  };

  await logActivity({
    userId: userId || 1,
    companyId,
    activityType: 'esxi_import',
    entityType: 'virtual_machine',
    entityId: metadata?.vmid || null,
    action,
    description: descriptions[action],
    status,
    metadata: {
      ...metadata,
      esxi_host_id: esxiHostId,
      target_cluster_id: clusterId,
      vm_name: vmName
    }
  });
};
