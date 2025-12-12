import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../config/database';
import logger from '../utils/logger';

/**
 * Get all NAT rules
 */
export const getNATRules = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { vmId, companyId } = req.query;

    let where: any = {};

    if (role === 'super_admin') {
      if (companyId) {
        where.company_id = Number(companyId);
      }
      if (vmId) {
        where.vm_id = Number(vmId);
      }
    } else if (company_id !== null) {
      where.company_id = company_id;
      if (vmId) {
        where.vm_id = Number(vmId);
      }
    } else {
      res.status(400).json({ success: false, message: 'No company associated with user' });
      return;
    }

    const rules = await prisma.nat_rules.findMany({
      where,
      include: {
        virtual_machines: {
          select: {
            id: true,
            name: true,
            vmid: true,
            node: true
          }
        },
        companies: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    res.json({ success: true, data: rules });
  } catch (error) {
    logger.error('Get NAT rules error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch NAT rules' });
  }
};

/**
 * Get single NAT rule
 */
export const getNATRule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    let where: any = { id: Number(id) };

    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
    }

    const rule = await prisma.nat_rules.findFirst({
      where,
      include: {
        virtual_machines: {
          select: {
            id: true,
            name: true,
            vmid: true,
            node: true
          }
        }
      }
    });

    if (!rule) {
      res.status(404).json({ success: false, message: 'NAT rule not found' });
      return;
    }

    res.json({ success: true, data: rule });
  } catch (error) {
    logger.error('Get NAT rule error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch NAT rule' });
  }
};

/**
 * Create NAT rule
 */
export const createNATRule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      vm_id,
      cluster_id,
      rule_name,
      external_ip,
      external_port,
      internal_ip,
      internal_port,
      protocol,
      description,
      enabled,
      nat_type
    } = req.body;

    const { role, company_id, id: userId } = req.user!;

    if (!cluster_id || !rule_name || !external_ip || !internal_ip || !protocol) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: cluster_id, rule_name, external_ip, internal_ip, protocol'
      });
      return;
    }

    // Verify cluster exists
    const cluster = await prisma.proxmox_clusters.findFirst({
      where: { id: cluster_id }
    });
    if (!cluster) {
      res.status(404).json({ success: false, message: 'Cluster not found' });
      return;
    }

    // If VM specified, verify it exists and get company_id from it
    let finalCompanyId = company_id;
    if (vm_id) {
      const vm = await prisma.virtual_machines.findFirst({
        where: { id: vm_id },
        select: { id: true, company_id: true }
      });

      if (!vm) {
        res.status(404).json({ success: false, message: 'VM not found' });
        return;
      }

      if (role !== 'super_admin' && vm.company_id !== company_id) {
        res.status(403).json({ success: false, message: 'Access denied to this VM' });
        return;
      }

      finalCompanyId = vm.company_id;
    }

    if (!finalCompanyId) {
      res.status(400).json({ success: false, message: 'Cannot determine company_id' });
      return;
    }

    const rule = await prisma.nat_rules.create({
      data: {
        company_id: finalCompanyId,
        cluster_id,
        vm_id: vm_id || null,
        nat_type: nat_type || 'port_forward',
        rule_name,
        external_ip,
        external_port: external_port ? Number(external_port) : null,
        internal_ip,
        internal_port: internal_port ? Number(internal_port) : null,
        protocol: protocol || 'tcp',
        description,
        enabled: enabled !== undefined ? enabled : true,
        status: 'pending',
        created_by: userId
      },
      include: {
        virtual_machines: {
          select: {
            id: true,
            name: true,
            vmid: true
          }
        }
      }
    });

    logger.info(`NAT rule created: ${rule.id}`);
    res.status(201).json({ success: true, data: rule });
  } catch (error) {
    logger.error('Create NAT rule error:', error);
    res.status(500).json({ success: false, message: 'Failed to create NAT rule' });
  }
};

/**
 * Update NAT rule
 */
export const updateNATRule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    // Check access
    let where: any = { id: Number(id) };
    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
    }

    const existing = await prisma.nat_rules.findFirst({ where });
    if (!existing) {
      res.status(404).json({ success: false, message: 'NAT rule not found or access denied' });
      return;
    }

    // Build update data
    const updateData: any = {};
    const allowedFields = [
      'rule_name',
      'external_ip',
      'external_port',
      'internal_ip',
      'internal_port',
      'protocol',
      'description',
      'enabled'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'external_port' || field === 'internal_port') {
          updateData[field] = req.body[field] ? Number(req.body[field]) : null;
        } else {
          updateData[field] = req.body[field];
        }
      }
    });

    const updated = await prisma.nat_rules.update({
      where: { id: Number(id) },
      data: updateData,
      include: {
        virtual_machines: {
          select: {
            id: true,
            name: true,
            vmid: true
          }
        }
      }
    });

    logger.info(`NAT rule updated: ${id}`);
    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Update NAT rule error:', error);
    res.status(500).json({ success: false, message: 'Failed to update NAT rule' });
  }
};

/**
 * Delete NAT rule
 */
export const deleteNATRule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    // Check access
    let where: any = { id: Number(id) };
    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
    }

    const existing = await prisma.nat_rules.findFirst({ where });
    if (!existing) {
      res.status(404).json({ success: false, message: 'NAT rule not found or access denied' });
      return;
    }

    await prisma.nat_rules.delete({
      where: { id: Number(id) }
    });

    logger.info(`NAT rule deleted: ${id}`);
    res.json({ success: true, message: 'NAT rule deleted successfully' });
  } catch (error) {
    logger.error('Delete NAT rule error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete NAT rule' });
  }
};

/**
 * Toggle NAT rule enabled status
 */
export const toggleNATRule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    let where: any = { id: Number(id) };
    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
    }

    const existing = await prisma.nat_rules.findFirst({ where });
    if (!existing) {
      res.status(404).json({ success: false, message: 'NAT rule not found or access denied' });
      return;
    }

    const updated = await prisma.nat_rules.update({
      where: { id: Number(id) },
      data: { enabled: !existing.enabled }
    });

    logger.info(`NAT rule toggled: ${id} (enabled: ${updated.enabled})`);
    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Toggle NAT rule error:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle NAT rule' });
  }
};

/**
 * Deploy NAT rule to infrastructure
 */
export const deployNATRule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id, id: userId } = req.user!;

    let where: any = { id: Number(id) };
    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
    }

    const existing = await prisma.nat_rules.findFirst({ where });
    if (!existing) {
      res.status(404).json({ success: false, message: 'NAT rule not found or access denied' });
      return;
    }

    // Import deployment service
    const natDeploymentService = await import('../services/natDeploymentService');
    const result = await natDeploymentService.deployNATRule(Number(id), userId);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: {
          executionTimeMs: result.executionTimeMs,
          command: result.command
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    logger.error('Deploy NAT rule error:', error);
    res.status(500).json({ success: false, message: 'Failed to deploy NAT rule' });
  }
};

/**
 * Undeploy/remove NAT rule from infrastructure
 */
export const undeployNATRule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id, id: userId } = req.user!;

    let where: any = { id: Number(id) };
    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
    }

    const existing = await prisma.nat_rules.findFirst({ where });
    if (!existing) {
      res.status(404).json({ success: false, message: 'NAT rule not found or access denied' });
      return;
    }

    const natDeploymentService = await import('../services/natDeploymentService');
    const result = await natDeploymentService.undeployNATRule(Number(id), userId);

    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    logger.error('Undeploy NAT rule error:', error);
    res.status(500).json({ success: false, message: 'Failed to undeploy NAT rule' });
  }
};

/**
 * Get deployment logs for a NAT rule
 */
export const getNATDeploymentLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    let where: any = { id: Number(id) };
    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
    }

    const rule = await prisma.nat_rules.findFirst({ where });
    if (!rule) {
      res.status(404).json({ success: false, message: 'NAT rule not found or access denied' });
      return;
    }

    const logs = await prisma.nat_deployment_log.findMany({
      where: { nat_rule_id: Number(id) },
      orderBy: { deployed_at: 'desc' },
      take: 20
    });

    res.json({ success: true, data: logs });
  } catch (error) {
    logger.error('Get NAT deployment logs error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch deployment logs' });
  }
};

/**
 * Test connection to NAT rule infrastructure (SSH or API)
 */
export const testNATConnection = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    let where: any = { id: Number(id) };
    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
    }

    const existing = await prisma.nat_rules.findFirst({ where });
    if (!existing) {
      res.status(404).json({ success: false, message: 'NAT rule not found or access denied' });
      return;
    }

    const natDeploymentService = await import('../services/natDeploymentService');
    const result = await natDeploymentService.testNATConnection(Number(id));

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: {
          output: result.output
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    logger.error('Test NAT connection error:', error);
    res.status(500).json({ success: false, message: 'Failed to test connection' });
  }
};

/**
 * Verify NAT rule deployment on infrastructure
 */
export const verifyNATDeployment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    let where: any = { id: Number(id) };
    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
    }

    const existing = await prisma.nat_rules.findFirst({ where });
    if (!existing) {
      res.status(404).json({ success: false, message: 'NAT rule not found or access denied' });
      return;
    }

    const natDeploymentService = await import('../services/natDeploymentService');
    const result = await natDeploymentService.verifyNATDeployment(Number(id));

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: {
          output: result.output,
          executionTimeMs: result.executionTimeMs
        }
      });
    } else {
      res.status(result.message.includes('not found') ? 404 : 500).json({
        success: false,
        message: result.message,
        data: {
          output: result.output,
          executionTimeMs: result.executionTimeMs
        }
      });
    }
  } catch (error) {
    logger.error('Verify NAT deployment error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify deployment' });
  }
};

// Get NAT performance statistics
export const getNATPerformanceStatsController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;

    // Only super_admin can view performance stats
    if (user.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    // Import the function
    const { getNATPerformanceStats } = await import('../utils/natMetricsHelper');

    // Optional cluster filter
    const clusterId = req.query.cluster_id ? parseInt(req.query.cluster_id as string) : undefined;

    const stats = await getNATPerformanceStats(clusterId);

    res.json({ success: true, data: stats });
  } catch (error: any) {
    logger.error('Get NAT performance stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to get performance stats', error: error.message });
  }
};
