import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth';
import logger from '../utils/logger';

const prisma = new PrismaClient();

export const getStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;

    let stats: any = {};

    if (role === 'super_admin') {
      // Super admin sees all statistics
      const [
        totalCompanies,
        totalUsers,
        totalClusters,
        totalVMs,
        totalProjects,
        totalIPRanges,
        activeCompanies,
        activeClusters,
        runningVMs,
      ] = await Promise.all([
        prisma.companies.count(),
        prisma.users.count(),
        prisma.proxmox_clusters.count(),
        prisma.virtual_machines.count(),
        prisma.vm_projects.count(),
        prisma.ip_ranges.count(),
        prisma.companies.count({ where: { status: 'active' } }),
        prisma.proxmox_clusters.count({ where: { status: 'active' } }),
        prisma.virtual_machines.count({ where: { status: 'running' } }),
      ]);

      stats = {
        companies: {
          total: totalCompanies,
          active: activeCompanies,
        },
        users: {
          total: totalUsers,
        },
        clusters: {
          total: totalClusters,
          active: activeClusters,
          offline: totalClusters - activeClusters,
        },
        vms: {
          total: totalVMs,
          running: runningVMs,
          stopped: totalVMs - runningVMs,
        },
        projects: {
          total: totalProjects,
        },
        ipRanges: {
          total: totalIPRanges,
        },
      };
    } else {
      // Company admin/user sees only their company's statistics
      const companyFilter = company_id !== null ? { company_id } : {};

      const [
        totalUsers,
        totalVMs,
        totalProjects,
        totalIPRanges,
        runningVMs,
        companyClusters,
      ] = await Promise.all([
        prisma.users.count({ where: companyFilter }),
        prisma.virtual_machines.count({ where: companyFilter }),
        prisma.vm_projects.count({ where: companyFilter }),
        prisma.ip_ranges.count({ where: companyFilter }),
        prisma.virtual_machines.count({
          where: { ...companyFilter, status: 'running' },
        }),
        prisma.proxmox_clusters.count({
          where: company_id !== null ? { company_id } : {},
        }),
      ]);

      stats = {
        users: {
          total: totalUsers,
        },
        clusters: {
          total: companyClusters,
        },
        vms: {
          total: totalVMs,
          running: runningVMs,
          stopped: totalVMs - runningVMs,
        },
        projects: {
          total: totalProjects,
        },
        ipRanges: {
          total: totalIPRanges,
        },
      };
    }

    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Get stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch statistics' });
  }
};
