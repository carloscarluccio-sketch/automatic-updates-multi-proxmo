import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../config/database';
import logger from '../utils/logger';
import { encrypt } from '../utils/encryption';

/**
 * Get SSO configuration for a company
 */
export const getSSOConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { companyId } = req.params;

    let targetCompanyId: number;

    if (companyId) {
      targetCompanyId = Number(companyId);
      if (role !== 'super_admin' && targetCompanyId !== company_id) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }
    } else {
      if (company_id === null) {
        res.status(400).json({ success: false, message: 'No company associated with user' });
        return;
      }
      targetCompanyId = company_id;
    }

    const config = await prisma.company_sso_config.findFirst({
      where: { company_id: targetCompanyId },
      select: {
        id: true,
        company_id: true,
        provider: true,
        client_id: true,
        tenant_id: true,
        authority_url: true,
        redirect_uri: true,
        scopes: true,
        enabled: true,
        auto_provision: true,
        default_role: true,
        require_domain_match: true,
        allowed_domains: true,
        attribute_mapping: true,
        settings: true,
        created_at: true,
        updated_at: true,
        last_tested_at: true,
        last_test_status: true,
        last_test_message: true
        // NOTE: client_secret NOT included for security
      }
    });

    if (!config) {
      res.status(404).json({ success: false, message: 'SSO configuration not found' });
      return;
    }

    res.json({ success: true, data: config });
  } catch (error) {
    logger.error('Get SSO config error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch SSO configuration' });
  }
};

/**
 * Create or update SSO configuration
 */
export const upsertSSOConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      provider,
      client_id,
      client_secret,
      tenant_id,
      authority_url,
      redirect_uri,
      scopes,
      enabled,
      auto_provision,
      default_role,
      require_domain_match,
      allowed_domains,
      attribute_mapping,
      settings
    } = req.body;

    const { role, company_id, id: userId } = req.user!;

    if (!client_id || !client_secret) {
      res.status(400).json({ success: false, message: 'client_id and client_secret are required' });
      return;
    }

    let targetCompanyId: number;
    if (role === 'super_admin' && req.body.company_id) {
      targetCompanyId = req.body.company_id;
    } else if (company_id !== null) {
      targetCompanyId = company_id;
    } else {
      res.status(400).json({ success: false, message: 'No company associated with user' });
      return;
    }

    // Encrypt client secret
    const encryptedSecret = encrypt(client_secret);

    // Parse JSON fields if they're strings
    const parsedAllowedDomains = typeof allowed_domains === 'string'
      ? allowed_domains
      : JSON.stringify(allowed_domains || []);

    const parsedAttributeMapping = typeof attribute_mapping === 'string'
      ? attribute_mapping
      : JSON.stringify(attribute_mapping || {});

    const parsedSettings = typeof settings === 'string'
      ? settings
      : JSON.stringify(settings || {});

    // Check if config exists
    const existing = await prisma.company_sso_config.findFirst({
      where: {
        company_id: targetCompanyId,
        provider: provider || 'microsoft'
      }
    });

    let config;
    if (existing) {
      // Update existing
      config = await prisma.company_sso_config.update({
        where: { id: existing.id },
        data: {
          client_id,
          client_secret: encryptedSecret,
          tenant_id,
          authority_url,
          redirect_uri,
          scopes: scopes || 'openid profile email User.Read',
          enabled: enabled !== undefined ? enabled : true,
          auto_provision: auto_provision !== undefined ? auto_provision : true,
          default_role: default_role || 'user',
          require_domain_match: require_domain_match !== undefined ? require_domain_match : true,
          allowed_domains: parsedAllowedDomains,
          attribute_mapping: parsedAttributeMapping,
          settings: parsedSettings
        },
        select: {
          id: true,
          company_id: true,
          provider: true,
          client_id: true,
          tenant_id: true,
          authority_url: true,
          redirect_uri: true,
          scopes: true,
          enabled: true,
          auto_provision: true,
          default_role: true,
          require_domain_match: true,
          allowed_domains: true,
          created_at: true,
          updated_at: true
        }
      });
    } else {
      // Create new
      config = await prisma.company_sso_config.create({
        data: {
          company_id: targetCompanyId,
          provider: provider || 'microsoft',
          client_id,
          client_secret: encryptedSecret,
          tenant_id,
          authority_url,
          redirect_uri,
          scopes: scopes || 'openid profile email User.Read',
          enabled: enabled !== undefined ? enabled : true,
          auto_provision: auto_provision !== undefined ? auto_provision : true,
          default_role: default_role || 'user',
          require_domain_match: require_domain_match !== undefined ? require_domain_match : true,
          allowed_domains: parsedAllowedDomains,
          attribute_mapping: parsedAttributeMapping,
          settings: parsedSettings,
          created_by: userId
        },
        select: {
          id: true,
          company_id: true,
          provider: true,
          client_id: true,
          tenant_id: true,
          authority_url: true,
          redirect_uri: true,
          scopes: true,
          enabled: true,
          auto_provision: true,
          default_role: true,
          require_domain_match: true,
          allowed_domains: true,
          created_at: true,
          updated_at: true
        }
      });
    }

    logger.info(`SSO config ${existing ? 'updated' : 'created'} for company ${targetCompanyId}`);
    res.status(existing ? 200 : 201).json({ success: true, data: config });
  } catch (error) {
    logger.error('Upsert SSO config error:', error);
    res.status(500).json({ success: false, message: 'Failed to save SSO configuration' });
  }
};

/**
 * Delete SSO configuration
 */
export const deleteSSOConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    let where: any = { id: Number(id) };
    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
    }

    const existing = await prisma.company_sso_config.findFirst({ where });
    if (!existing) {
      res.status(404).json({ success: false, message: 'SSO config not found or access denied' });
      return;
    }

    await prisma.company_sso_config.delete({
      where: { id: Number(id) }
    });

    logger.info(`SSO config deleted: ${id}`);
    res.json({ success: true, message: 'SSO configuration deleted successfully' });
  } catch (error) {
    logger.error('Delete SSO config error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete SSO configuration' });
  }
};

/**
 * Test SSO connection
 */
export const testSSOConnection = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    let where: any = { id: Number(id) };
    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
    }

    const config = await prisma.company_sso_config.findFirst({ where });
    if (!config) {
      res.status(404).json({ success: false, message: 'SSO config not found or access denied' });
      return;
    }

    // Validate configuration fields
    const errors: string[] = [];

    if (!config.client_id) errors.push('Missing client_id');
    if (!config.client_secret) errors.push('Missing client_secret');
    if (config.provider === 'microsoft' && !config.tenant_id) errors.push('Missing tenant_id for Microsoft provider');

    const testSuccess = errors.length === 0;

    await prisma.company_sso_config.update({
      where: { id: Number(id) },
      data: {
        last_tested_at: new Date(),
        last_test_status: testSuccess ? 'success' : 'failed',
        last_test_message: testSuccess ? 'Configuration validated' : errors.join(', ')
      }
    });

    logger.info(`SSO connection tested: ${id} (${testSuccess ? 'success' : 'failed'})`);
    res.json({
      success: testSuccess,
      message: testSuccess ? 'SSO configuration is valid' : 'SSO configuration has errors',
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    logger.error('Test SSO connection error:', error);
    res.status(500).json({ success: false, message: 'Failed to test SSO connection' });
  }
};

/**
 * Get SSO login audit logs
 */
export const getSSOAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { companyId, limit } = req.query;

    let where: any = {};

    if (role === 'super_admin') {
      if (companyId) {
        where.company_id = Number(companyId);
      }
    } else if (company_id !== null) {
      where.company_id = company_id;
    } else {
      res.status(400).json({ success: false, message: 'No company associated with user' });
      return;
    }

    const logs = await prisma.sso_login_audit.findMany({
      where,
      include: {
        companies: {
          select: { id: true, name: true }
        }
      },
      orderBy: { created_at: 'desc' },
      take: limit ? Number(limit) : 100
    });

    res.json({ success: true, data: logs });
  } catch (error) {
    logger.error('Get SSO audit logs error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch SSO audit logs' });
  }
};
