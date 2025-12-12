import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../config/database';
import logger from '../utils/logger';
import crypto from 'crypto';
import bcrypt from 'bcrypt';

/**
 * Generate a secure API token
 */
function generateToken(): { token: string; prefix: string; hash: string } {
  const token = crypto.randomBytes(32).toString('hex');
  const prefix = token.substring(0, 12);
  const hash = bcrypt.hashSync(token, 10);
  return { token: `pmt_${token}`, prefix: `pmt_${prefix}`, hash };
}

/**
 * Get all API tokens
 */
export const getTokens = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;

    let where: any = {};

    if (role === 'super_admin') {
      // Super admin can filter by company
      if (req.query.company_id) {
        where.company_id = Number(req.query.company_id);
      }
    } else if (company_id !== null) {
      where.company_id = company_id;
    } else {
      res.status(400).json({ success: false, message: 'No company associated with user' });
      return;
    }

    const tokens = await prisma.api_tokens.findMany({
      where,
      select: {
        id: true,
        user_id: true,
        company_id: true,
        name: true,
        token_prefix: true,
        scopes: true,
        ip_whitelist: true,
        rate_limit: true,
        expires_at: true,
        last_used_at: true,
        last_used_ip: true,
        request_count: true,
        is_active: true,
        created_at: true,
        revoked_at: true
      },
      orderBy: { created_at: 'desc' }
    });

    // Convert BigInt to number for JSON serialization
    const tokensWithNumbers = tokens.map(token => ({
      ...token,
      request_count: token.request_count ? Number(token.request_count) : 0
    }));

    res.json({ success: true, data: tokensWithNumbers });
  } catch (error) {
    logger.error('Get tokens error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tokens' });
  }
};

/**
 * Create new API token
 */
export const createToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      name,
      scopes,
      ip_whitelist,
      rate_limit,
      expires_at
    } = req.body;

    const { role, company_id, id: userId } = req.user!;

    if (!name) {
      res.status(400).json({ success: false, message: 'Token name is required' });
      return;
    }

    // Determine company_id
    let finalCompanyId: number;
    if (role === 'super_admin' && req.body.company_id) {
      finalCompanyId = req.body.company_id;
    } else if (company_id !== null) {
      finalCompanyId = company_id;
    } else {
      res.status(400).json({ success: false, message: 'No company associated with user' });
      return;
    }

    // Generate token
    const { token, prefix, hash } = generateToken();

    // Parse scopes (should be JSON array)
    let scopesData = '["read"]';
    if (scopes) {
      scopesData = typeof scopes === 'string' ? scopes : JSON.stringify(scopes);
    }

    // Parse IP whitelist
    let ipWhitelistData = null;
    if (ip_whitelist) {
      ipWhitelistData = typeof ip_whitelist === 'string' ? ip_whitelist : JSON.stringify(ip_whitelist);
    }

    const apiToken = await prisma.api_tokens.create({
      data: {
        user_id: userId!,
        company_id: finalCompanyId,
        name,
        token_hash: hash,
        token_prefix: prefix,
        scopes: scopesData,
        ip_whitelist: ipWhitelistData,
        rate_limit: rate_limit || 100,
        expires_at: expires_at ? new Date(expires_at) : null,
        is_active: true
      }
    });

    logger.info(`API token created: ${apiToken.id} for company ${finalCompanyId}`);

    // Return the plain token ONLY on creation (never again)
    res.status(201).json({
      success: true,
      data: {
        id: apiToken.id,
        name: apiToken.name,
        token_prefix: apiToken.token_prefix,
        token: token, // Full token shown ONLY once
        scopes: apiToken.scopes,
        rate_limit: apiToken.rate_limit,
        expires_at: apiToken.expires_at,
        created_at: apiToken.created_at
      },
      message: 'IMPORTANT: Save this token now. You will not be able to see it again.'
    });
  } catch (error) {
    logger.error('Create token error:', error);
    res.status(500).json({ success: false, message: 'Failed to create token' });
  }
};

/**
 * Update API token (scopes, rate limit, etc)
 */
export const updateToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    // Check access
    let where: any = { id: Number(id) };
    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
    }

    const existing = await prisma.api_tokens.findFirst({ where });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Token not found or access denied' });
      return;
    }

    // Build update data
    const updateData: any = {};

    if (req.body.name !== undefined) updateData.name = req.body.name;
    if (req.body.is_active !== undefined) updateData.is_active = req.body.is_active;
    if (req.body.rate_limit !== undefined) updateData.rate_limit = req.body.rate_limit;

    if (req.body.scopes !== undefined) {
      updateData.scopes = typeof req.body.scopes === 'string'
        ? req.body.scopes
        : JSON.stringify(req.body.scopes);
    }

    if (req.body.ip_whitelist !== undefined) {
      updateData.ip_whitelist = req.body.ip_whitelist
        ? (typeof req.body.ip_whitelist === 'string'
            ? req.body.ip_whitelist
            : JSON.stringify(req.body.ip_whitelist))
        : null;
    }

    if (req.body.expires_at !== undefined) {
      updateData.expires_at = req.body.expires_at ? new Date(req.body.expires_at) : null;
    }

    const updated = await prisma.api_tokens.update({
      where: { id: Number(id) },
      data: updateData,
      select: {
        id: true,
        name: true,
        token_prefix: true,
        scopes: true,
        ip_whitelist: true,
        rate_limit: true,
        expires_at: true,
        is_active: true,
        last_used_at: true,
        request_count: true
      }
    });

    logger.info(`API token updated: ${id}`);
    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Update token error:', error);
    res.status(500).json({ success: false, message: 'Failed to update token' });
  }
};

/**
 * Revoke API token
 */
export const revokeToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id, id: userId } = req.user!;

    // Check access
    let where: any = { id: Number(id) };
    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
    }

    const existing = await prisma.api_tokens.findFirst({ where });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Token not found or access denied' });
      return;
    }

    await prisma.api_tokens.update({
      where: { id: Number(id) },
      data: {
        is_active: false,
        revoked_at: new Date(),
        revoked_by: userId
      }
    });

    logger.info(`API token revoked: ${id}`);
    res.json({ success: true, message: 'Token revoked successfully' });
  } catch (error) {
    logger.error('Revoke token error:', error);
    res.status(500).json({ success: false, message: 'Failed to revoke token' });
  }
};

/**
 * Delete API token
 */
export const deleteToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    // Check access
    let where: any = { id: Number(id) };
    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
    }

    const existing = await prisma.api_tokens.findFirst({ where });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Token not found or access denied' });
      return;
    }

    await prisma.api_tokens.delete({
      where: { id: Number(id) }
    });

    logger.info(`API token deleted: ${id}`);
    res.json({ success: true, message: 'Token deleted successfully' });
  } catch (error) {
    logger.error('Delete token error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete token' });
  }
};
