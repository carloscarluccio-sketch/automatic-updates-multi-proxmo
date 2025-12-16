// @ts-nocheck
import { Request, Response } from 'express';
import prisma from '../config/database';
import logger from '../utils/logger';
import { NginxConfigService } from '../services/nginxConfigService';
import { AuthRequest } from '../middlewares/auth';

/**
 * Deploy Nginx configuration for a URL mapping
 */
export const deployNginxConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!id) {
      res.status(400).json({ success: false, message: 'URL mapping ID required' });
      return;
    }

    // Fetch URL mapping
    const mapping = await prisma.company_url_mappings.findUnique({
      where: { id: parseInt(id) }
    });

    if (!mapping) {
      res.status(404).json({ success: false, message: 'URL mapping not found' });
      return;
    }

    // Check permissions
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { role: true, company_id: true }
    });

    if (user?.role !== 'super_admin' && user?.company_id !== mapping.company_id) {
      res.status(403).json({ success: false, message: 'Not authorized' });
      return;
    }

    // Deploy Nginx configuration
    const result = await NginxConfigService.deployURLMapping({
      id: mapping.id,
      company_id: mapping.company_id,
      url_pattern: mapping.url_pattern,
      ssl_enabled: Boolean(mapping.ssl_enabled),
      ssl_certificate: mapping.ssl_certificate || undefined,
      ssl_private_key: mapping.ssl_private_key || undefined,
      ssl_chain: mapping.ssl_chain || undefined,
      use_letsencrypt: Boolean(mapping.use_letsencrypt),
      letsencrypt_email: mapping.letsencrypt_email || undefined,
    });

    if (result.success) {
      // Update mapping status
      await prisma.company_url_mappings.update({
        where: { id: mapping.id },
        data: {
          ssl_status: mapping.ssl_enabled ? 'active' : 'pending',
          ssl_last_checked: new Date(),
          ssl_error_message: null
        }
      });
    } else {
      // Update with error
      await prisma.company_url_mappings.update({
        where: { id: mapping.id },
        data: {
          ssl_status: 'failed',
          ssl_last_checked: new Date(),
          ssl_error_message: result.message
        }
      });
    }

    res.json(result);
  } catch (error: any) {
    logger.error('Deploy Nginx config error:', error);
    res.status(500).json({ success: false, message: 'Failed to deploy configuration' });
  }
};

/**
 * Remove Nginx configuration for a URL mapping
 */
export const removeNginxConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!id) {
      res.status(400).json({ success: false, message: 'URL mapping ID required' });
      return;
    }

    // Fetch URL mapping
    const mapping = await prisma.company_url_mappings.findUnique({
      where: { id: parseInt(id) }
    });

    if (!mapping) {
      res.status(404).json({ success: false, message: 'URL mapping not found' });
      return;
    }

    // Check permissions
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { role: true, company_id: true }
    });

    if (user?.role !== 'super_admin' && user?.company_id !== mapping.company_id) {
      res.status(403).json({ success: false, message: 'Not authorized' });
      return;
    }

    // Remove Nginx configuration
    const result = await NginxConfigService.removeURLMapping(mapping.url_pattern);

    res.json(result);
  } catch (error: any) {
    logger.error('Remove Nginx config error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove configuration' });
  }
};

/**
 * Test Nginx configuration
 */
export const testNginxConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    // Only super_admin can test Nginx config
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (user?.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Only super admin can test Nginx configuration' });
      return;
    }

    const result = await NginxConfigService.testConfig();
    res.json(result);
  } catch (error: any) {
    logger.error('Test Nginx config error:', error);
    res.status(500).json({ success: false, message: 'Failed to test configuration' });
  }
};

/**
 * Reload Nginx
 */
export const reloadNginx = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    // Only super_admin can reload Nginx
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (user?.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Only super admin can reload Nginx' });
      return;
    }

    const result = await NginxConfigService.reload();
    res.json(result);
  } catch (error: any) {
    logger.error('Reload Nginx error:', error);
    res.status(500).json({ success: false, message: 'Failed to reload Nginx' });
  }
};

/**
 * Generate Nginx configuration preview
 */
export const previewNginxConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { url_pattern, ssl_enabled, use_letsencrypt } = req.body;

    if (!url_pattern) {
      res.status(400).json({ success: false, message: 'URL pattern required' });
      return;
    }

    // Create temporary mapping object for preview
    const mapping = {
      id: 0,
      company_id: 0,
      url_pattern,
      ssl_enabled: Boolean(ssl_enabled),
      use_letsencrypt: Boolean(use_letsencrypt),
    };

    const result = await NginxConfigService.generateConfig(mapping);

    if (result.success && result.configPath) {
      // Read the generated config
      const fs = require('fs');
      const configContent = fs.readFileSync(result.configPath, 'utf-8');

      // Remove the preview file
      fs.unlinkSync(result.configPath);

      res.json({
        success: true,
        message: 'Configuration preview generated',
        config: configContent
      });
    } else {
      res.json(result);
    }
  } catch (error: any) {
    logger.error('Preview Nginx config error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate preview' });
  }
};
