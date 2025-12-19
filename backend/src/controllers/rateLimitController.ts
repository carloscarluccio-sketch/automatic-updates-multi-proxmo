import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient();

/**
 * List all rate limit configurations
 * GET /api/rate-limits
 */
export const listRateLimits = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;

    // Only super_admin can view rate limit configs
    if (user.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const rateLimits = await prisma.rate_limits.findMany({
      orderBy: { endpoint: 'asc' }
    });

    res.json({ success: true, data: rateLimits });
  } catch (error: any) {
    logger.error('List rate limits error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch rate limits' });
  }
};

/**
 * Get single rate limit configuration
 * GET /api/rate-limits/:id
 */
export const getRateLimit = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;

    if (user.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const rateLimitId = parseInt(req.params.id);

    const rateLimit = await prisma.rate_limits.findUnique({
      where: { id: rateLimitId }
    });

    if (!rateLimit) {
      res.status(404).json({ success: false, message: 'Rate limit configuration not found' });
      return;
    }

    res.json({ success: true, data: rateLimit });
  } catch (error: any) {
    logger.error('Get rate limit error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch rate limit configuration' });
  }
};

/**
 * Create new rate limit configuration
 * POST /api/rate-limits
 */
export const createRateLimit = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;

    if (user.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const { endpoint, method: _method, max_requests, window_seconds, block_duration_seconds: _block_duration_seconds, description: _description, is_enabled: _is_enabled } = req.body;

    // Validation
    if (!endpoint || !max_requests || !window_seconds) {
      res.status(400).json({ success: false, message: 'Endpoint, max_requests, and window_seconds are required' });
      return;
    }

    if (max_requests < 1) {
      res.status(400).json({ success: false, message: 'max_requests must be at least 1' });
      return;
    }

    if (window_seconds < 1) {
      res.status(400).json({ success: false, message: 'window_seconds must be at least 1' });
      return;
    }

    const rateLimit = await prisma.rate_limits.create({
      data: {
        identifier: "system",
        identifier_type: "ip",
        endpoint: endpoint
      }
    });
    logger.info(`Rate limit created for ${endpoint} by user ${user.id}`);
    res.json({ success: true, data: rateLimit });
  } catch (error: any) {
    logger.error('Create rate limit error:', error);

    if (error.code === 'P2002') {
      res.status(409).json({ success: false, message: 'Rate limit configuration already exists for this endpoint and method' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to create rate limit configuration' });
    }
  }
};

/**
 * Update rate limit configuration
 * PATCH /api/rate-limits/:id
 */
export const updateRateLimit = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;

    if (user.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const rateLimitId = parseInt(req.params.id);
    const { endpoint, method, max_requests, window_seconds, block_duration_seconds, description, is_enabled } = req.body;

    // Check if exists
    const existing = await prisma.rate_limits.findUnique({
      where: { id: rateLimitId }
    });

    if (!existing) {
      res.status(404).json({ success: false, message: 'Rate limit configuration not found' });
      return;
    }

    // Validation
    if (max_requests !== undefined && max_requests < 1) {
      res.status(400).json({ success: false, message: 'max_requests must be at least 1' });
      return;
    }

    if (window_seconds !== undefined && window_seconds < 1) {
      res.status(400).json({ success: false, message: 'window_seconds must be at least 1' });
      return;
    }

    const updateData: any = {};
    if (endpoint !== undefined) updateData.endpoint = endpoint;
    if (method !== undefined) updateData.method = method;
    if (max_requests !== undefined) updateData.max_requests = max_requests;
    if (window_seconds !== undefined) updateData.window_seconds = window_seconds;
    if (block_duration_seconds !== undefined) updateData.block_duration_seconds = block_duration_seconds;
    if (description !== undefined) updateData.description = description;
    if (is_enabled !== undefined) updateData.is_enabled = is_enabled;

    const rateLimit = await prisma.rate_limits.update({
      where: { id: rateLimitId },
      data: updateData
    });

    logger.info(`Rate limit ${rateLimitId} updated by user ${user.id}`);
    res.json({ success: true, data: rateLimit });
  } catch (error: any) {
    logger.error('Update rate limit error:', error);

    if (error.code === 'P2002') {
      res.status(409).json({ success: false, message: 'Rate limit configuration already exists for this endpoint and method' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to update rate limit configuration' });
    }
  }
};

/**
 * Delete rate limit configuration
 * DELETE /api/rate-limits/:id
 */
export const deleteRateLimit = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;

    if (user.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const rateLimitId = parseInt(req.params.id);

    const existing = await prisma.rate_limits.findUnique({
      where: { id: rateLimitId }
    });

    if (!existing) {
      res.status(404).json({ success: false, message: 'Rate limit configuration not found' });
      return;
    }

    await prisma.rate_limits.delete({
      where: { id: rateLimitId }
    });

    logger.info(`Rate limit ${rateLimitId} deleted by user ${user.id}`);
    res.json({ success: true, message: 'Rate limit configuration deleted' });
  } catch (error: any) {
    logger.error('Delete rate limit error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete rate limit configuration' });
  }
};

/**
 * Get rate limit statistics
 * GET /api/rate-limits/stats
 */
export const getRateLimitStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;

    if (user.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const [totalConfigs, enabledConfigs, recentBlocks] = await Promise.all([
      prisma.rate_limits.count(),
      prisma.rate_limits.count(),
      prisma.rate_limits.count({
        where: {
          blocked_until: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      })
    ]);

    const stats = {
      total_configs: totalConfigs,
      enabled_configs: enabledConfigs,
      disabled_configs: totalConfigs - enabledConfigs,
      recent_blocks_24h: recentBlocks
    };

    res.json({ success: true, data: stats });
  } catch (error: any) {
    logger.error('Get rate limit stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch statistics' });
  }
};

/**
 * Get recent rate limit violations
 * GET /api/rate-limits/violations
 */
export const getRateLimitViolations = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;

    if (user.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const { hours = 24, limit = 100 } = req.query;
    const hoursNum = parseInt(hours as string);
    const limitNum = parseInt(limit as string);

    const violations = await prisma.rate_limits.findMany({
      where: {
        blocked_until: {
          gte: new Date(Date.now() - hoursNum * 60 * 60 * 1000)
        }
      },
      orderBy: {
        blocked_until: 'desc'
      },
      take: limitNum
    });

    res.json({ success: true, data: violations });
  } catch (error: any) {
    logger.error('Get rate limit violations error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch violations' });
  }
};

export default {
  listRateLimits,
  getRateLimit,
  createRateLimit,
  updateRateLimit,
  deleteRateLimit,
  getRateLimitStats,
  getRateLimitViolations
};
