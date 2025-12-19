import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient();

/**
 * Global search across multiple entities
 * GET /api/search/global
 */
export const globalSearch = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const { query, entity_type, limit = 50 } = req.query;

    if (!query || (query as string).length < 2) {
      res.status(400).json({ success: false, message: 'Search query must be at least 2 characters' });
      return;
    }

    // const searchTerm = `%${query}%`;
    const maxLimit = Math.min(parseInt(limit as string) || 50, 100);
    const results: any = {
      vms: [],
      companies: [],
      users: [],
      clusters: [],
      projects: [],
      tickets: []
    };

    // Role-based filtering
    const companyFilter = user.role === 'super_admin' ? {} : { company_id: user.company_id };

    // Search VMs
    if (!entity_type || entity_type === 'vms') {
      results.vms = await prisma.virtual_machines.findMany({
        where: {
          ...companyFilter,
          OR: [
            { name: { contains: query as string } },
            { vmid: { equals: isNaN(parseInt(query as string)) ? undefined : parseInt(query as string) } },
            { primary_ip_internal: { contains: query as string } },
            { primary_ip_external: { contains: query as string } }
          ]
        },
        include: {
          companies: { select: { id: true, name: true } },
          proxmox_clusters: { select: { id: true, name: true } },
          vm_projects: { select: { id: true, name: true } }
        },
        take: maxLimit
      });
    }

    // Search Companies (super_admin only)
    if (user.role === 'super_admin' && (!entity_type || entity_type === 'companies')) {
      results.companies = await prisma.companies.findMany({
        where: {
          OR: [
            { name: { contains: query as string } },
            { primary_email: { contains: query as string } },
            { contact_phone: { contains: query as string } }
          ]
        },
        take: maxLimit
      });
    }

    // Search Users
    if (!entity_type || entity_type === 'users') {
      results.users = await prisma.users.findMany({
        where: {
          ...companyFilter,
          OR: [
            { username: { contains: query as string } },
            { email: { contains: query as string } },
            { first_name: { contains: query as string } },
            { last_name: { contains: query as string } }
          ]
        },
        select: {
          id: true,
          username: true,
          email: true,
          first_name: true,
          last_name: true,
          role: true,
          company_id: true,
          companies: { select: { name: true } }
        },
        take: maxLimit
      });
    }

    // Search Clusters (super_admin only)
    if (user.role === 'super_admin' && (!entity_type || entity_type === 'clusters')) {
      results.clusters = await prisma.proxmox_clusters.findMany({
        where: {
          OR: [
            { name: { contains: query as string } },
            { host: { contains: query as string } },
            { location: { contains: query as string } }
          ]
        },
        take: maxLimit
      });
    }

    // Search Projects
    if (!entity_type || entity_type === 'projects') {
      results.projects = await prisma.vm_projects.findMany({
        where: {
          ...companyFilter,
          OR: [
            { name: { contains: query as string } },
            { description: { contains: query as string } }
          ]
        },
        include: {
          companies: { select: { id: true, name: true } }
        },
        take: maxLimit
      });
    }

    // Search Support Tickets
    if (!entity_type || entity_type === 'tickets') {
      results.tickets = await prisma.support_tickets.findMany({
        where: {
          ...companyFilter,
          OR: [
            { subject: { contains: query as string } },
            { description: { contains: query as string } }
          ]
        },
        include: {
          companies: { select: { id: true, name: true } },
          users_support_tickets_created_byTousers: {
            select: { id: true, email: true, username: true }
          }
        },
        take: maxLimit
      });
    }

    // Calculate totals
    const totals = {
      vms: results.vms.length,
      companies: results.companies.length,
      users: results.users.length,
      clusters: results.clusters.length,
      projects: results.projects.length,
      tickets: results.tickets.length,
      total: Object.values(results).reduce((sum: number, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0 as number)
    };

    logger.info(`User ${user.id} searched for "${query}" - ${totals.total} results`);
    res.json({ success: true, data: { results, totals, query } });
  } catch (error: any) {
    logger.error('Global search error:', error);
    res.status(500).json({ success: false, message: 'Search failed' });
  }
};

/**
 * Advanced VM search with multiple filters
 * GET /api/search/vms
 */
export const advancedVMSearch = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const {
      query,
      company_id,
      cluster_id,
      project_id,
      status,
      min_cpu,
      max_cpu,
      min_memory,
      max_memory,
      has_ip,
      limit = 100
    } = req.query;

    const where: any = {};

    // Role-based filtering
    if (user.role !== 'super_admin') {
      where.company_id = user.company_id;
    } else if (company_id) {
      where.company_id = parseInt(company_id as string);
    }

    // Text search
    if (query) {
      where.OR = [
        { name: { contains: query as string } },
        { primary_ip_internal: { contains: query as string } },
        { primary_ip_external: { contains: query as string } }
      ];
    }

    // Cluster filter
    if (cluster_id) {
      where.cluster_id = parseInt(cluster_id as string);
    }

    // Project filter
    if (project_id) {
      where.project_id = parseInt(project_id as string);
    }

    // Status filter
    if (status) {
      where.status = status;
    }

    // CPU range
    if (min_cpu || max_cpu) {
      where.cpu_cores = {};
      if (min_cpu) where.cpu_cores.gte = parseInt(min_cpu as string);
      if (max_cpu) where.cpu_cores.lte = parseInt(max_cpu as string);
    }

    // Memory range
    if (min_memory || max_memory) {
      where.memory = {};
      if (min_memory) where.memory.gte = parseInt(min_memory as string);
      if (max_memory) where.memory.lte = parseInt(max_memory as string);
    }

    // IP assignment filter
    if (has_ip === 'true') {
      where.OR = [
        { primary_ip_internal: { not: null } },
        { primary_ip_external: { not: null } }
      ];
    } else if (has_ip === 'false') {
      where.AND = [
        { primary_ip_internal: null },
        { primary_ip_external: null }
      ];
    }

    const vms = await prisma.virtual_machines.findMany({
      where,
      include: {
        companies: { select: { id: true, name: true } },
        proxmox_clusters: { select: { id: true, name: true } },
        vm_projects: { select: { id: true, name: true } }
      },
      take: Math.min(parseInt(limit as string) || 100, 500),
      orderBy: { created_at: 'desc' }
    });

    logger.info(`User ${user.id} performed advanced VM search - ${vms.length} results`);
    res.json({ success: true, data: vms, total: vms.length });
  } catch (error: any) {
    logger.error('Advanced VM search error:', error);
    res.status(500).json({ success: false, message: 'Advanced search failed' });
  }
};

export default {
  globalSearch,
  advancedVMSearch
};
