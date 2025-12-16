import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient();

/**
 * Global search across multiple entities
 * GET /api/search?q=query&types=vms,companies,users
 */
export const globalSearch = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const { q, types } = req.query;

    if (!q || typeof q !== 'string' || q.length < 2) {
      res.status(400).json({ success: false, message: 'Search query must be at least 2 characters' });
      return;
    }

    const searchTerm = q.toLowerCase();
    const searchTypes = types ? (types as string).split(',') : ['vms', 'companies', 'users', 'tickets', 'clusters'];

    const results: any = {
      vms: [],
      companies: [],
      users: [],
      tickets: [],
      clusters: [],
      projects: [],
      ip_ranges: []
    };

    const companyFilter = user.role === 'super_admin' ? {} : { company_id: user.company_id };

    // Search VMs
    if (searchTypes.includes('vms')) {
      results.vms = await prisma.virtual_machines.findMany({
        where: {
          ...companyFilter,
          OR: [
            { name: { contains: searchTerm } },
            { vmid: { equals: isNaN(parseInt(searchTerm)) ? -1 : parseInt(searchTerm) } },
            { primary_ip_internal: { contains: searchTerm } },
            { primary_ip_external: { contains: searchTerm } }
          ]
        },
        select: {
          id: true,
          name: true,
          vmid: true,
          primary_ip_internal: true,
          primary_ip_external: true,
          status: true,
          companies: { select: { name: true } },
          proxmox_clusters: { select: { name: true } }
        },
        take: 10
      });
    }

    // Search Companies (super_admin only)
    if (searchTypes.includes('companies') && user.role === 'super_admin') {
      results.companies = await prisma.companies.findMany({
        where: {
          OR: [
            { name: { contains: searchTerm } },
            { primary_email: { contains: searchTerm } },
            { contact_email: { contains: searchTerm } }
          ]
        },
        select: {
          id: true,
          name: true,
          primary_email: true,
          contact_phone: true,
          status: true
        },
        take: 10
      });
    }

    // Search Users
    if (searchTypes.includes('users')) {
      results.users = await prisma.users.findMany({
        where: {
          ...companyFilter,
          OR: [
            { username: { contains: searchTerm } },
            { email: { contains: searchTerm } },
            { first_name: { contains: searchTerm } },
            { last_name: { contains: searchTerm } }
          ]
        },
        select: {
          id: true,
          username: true,
          email: true,
          first_name: true,
          last_name: true,
          role: true,
          companies: { select: { name: true } }
        },
        take: 10
      });
    }

    // Search Support Tickets
    if (searchTypes.includes('tickets')) {
      results.tickets = await prisma.support_tickets.findMany({
        where: {
          ...companyFilter,
          OR: [
            { ticket_number: { contains: searchTerm.toUpperCase() } },
            { subject: { contains: searchTerm } },
            { description: { contains: searchTerm } }
          ]
        },
        select: {
          id: true,
          ticket_number: true,
          subject: true,
          status: true,
          priority: true,
          opened_at: true,
          companies: { select: { name: true } }
        },
        take: 10
      });
    }

    // Search Clusters (super_admin only)
    if (searchTypes.includes('clusters') && user.role === 'super_admin') {
      results.clusters = await prisma.proxmox_clusters.findMany({
        where: {
          OR: [
            { name: { contains: searchTerm } },
            { host: { contains: searchTerm } },
            { location: { contains: searchTerm } }
          ]
        },
        select: {
          id: true,
          name: true,
          host: true,
          location: true,
          status: true
        },
        take: 10
      });
    }

    // Search Projects
    if (searchTypes.includes('projects')) {
      results.projects = await prisma.vm_projects.findMany({
        where: {
          ...companyFilter,
          OR: [
            { name: { contains: searchTerm } },
            { description: { contains: searchTerm } }
          ]
        },
        select: {
          id: true,
          name: true,
          description: true,
          companies: { select: { name: true } }
        },
        take: 10
      });
    }

    // Search IP Ranges
    if (searchTypes.includes('ip_ranges')) {
      results.ip_ranges = await prisma.ip_ranges.findMany({
        where: {
          ...companyFilter,
          OR: [
            { description: { contains: searchTerm } },
            { subnet: { contains: searchTerm } },
            { gateway: { contains: searchTerm } }
          ]
        },
        select: {
          id: true,
          subnet: true,
          description: true,
          gateway: true,
          vlan_id: true,
          companies: { select: { name: true } }
        },
        take: 10
      });
    }

    // Calculate total results
    let totalResults = 0;
    Object.values(results).forEach((arr: any) => {
      totalResults += arr.length;
    });

    // Save search history
    try {
      await prisma.search_history.create({
        data: {
          user_id: user.id,
          search_query: q as string,
          results_count: totalResults,
          search_type: 'global'
        }
      });
    } catch (err) {
      // Don't fail the search if history logging fails
      logger.warn('Failed to log search history:', err);
    }

    res.json({
      success: true,
      data: {
        query: q,
        total_results: totalResults,
        results
      }
    });
  } catch (error: any) {
    logger.error('Global search error:', error);
    res.status(500).json({ success: false, message: 'Search failed' });
  }
};

/**
 * Get search suggestions
 * GET /api/search/suggestions?q=query
 */
export const getSearchSuggestions = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const { q } = req.query;

    if (!q || typeof q !== 'string' || q.length < 2) {
      res.json({ success: true, data: { suggestions: [] } });
      return;
    }

    const searchTerm = q.toLowerCase();

    // Get suggestions from search history
    const historySuggestions = await prisma.search_history.findMany({
      where: {
        user_id: user.id,
        search_query: { contains: searchTerm }
      },
      select: { search_query: true },
      distinct: ['search_query'],
      orderBy: { search_date: 'desc' },
      take: 5
    });

    // Get suggestions from predefined suggestions table
    const predefinedSuggestions = await prisma.search_suggestions.findMany({
      where: {
        suggestion_text: { contains: searchTerm }
      },
      select: { suggestion_text: true, category: true },
      orderBy: { popularity_score: 'desc' },
      take: 5
    });

    const suggestions = [
      ...historySuggestions.map(s => ({ text: s.search_query, source: 'history' })),
      ...predefinedSuggestions.map(s => ({ text: s.suggestion_text, source: 'suggested', category: s.category }))
    ];

    res.json({ success: true, data: { suggestions } });
  } catch (error: any) {
    logger.error('Search suggestions error:', error);
    res.json({ success: true, data: { suggestions: [] } });
  }
};

/**
 * Get recent searches
 * GET /api/search/history
 */
export const getSearchHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;

    const history = await prisma.search_history.findMany({
      where: { user_id: user.id },
      select: {
        id: true,
        search_query: true,
        results_count: true,
        search_type: true,
        search_date: true
      },
      orderBy: { search_date: 'desc' },
      take: 20
    });

    res.json({ success: true, data: history });
  } catch (error: any) {
    logger.error('Search history error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch search history' });
  }
};
