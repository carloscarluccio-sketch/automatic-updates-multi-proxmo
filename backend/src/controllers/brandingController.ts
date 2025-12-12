import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../config/database';
import logger from '../utils/logger';

/**
 * Get company branding settings
 */
export const getBranding = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { companyId } = req.params;

    // Determine which company to get branding for
    let targetCompanyId: number;

    if (companyId) {
      targetCompanyId = Number(companyId);
      // Only super_admin can get other companies' branding
      if (role !== 'super_admin' && targetCompanyId !== company_id) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }
    } else {
      // Get current user's company branding
      if (company_id === null) {
        res.status(400).json({ success: false, message: 'No company associated with user' });
        return;
      }
      targetCompanyId = company_id;
    }

    const company = await prisma.companies.findUnique({
      where: { id: targetCompanyId },
      select: {
        id: true,
        name: true,
        logo_filename: true,
        panel_name: true,
        header_color: true,
        menu_color: true,
        login_bg_color: true,
      }
    });

    if (!company) {
      res.status(404).json({ success: false, message: 'Company not found' });
      return;
    }

    res.json({ success: true, data: company });
  } catch (error) {
    logger.error('Get branding error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch branding' });
  }
};

/**
 * Update company branding settings
 */
export const updateBranding = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { companyId } = req.params;
    const {
      logo_filename,
      panel_name,
      header_color,
      menu_color,
      login_bg_color
    } = req.body;

    // Determine which company to update
    let targetCompanyId: number;

    if (companyId) {
      targetCompanyId = Number(companyId);
      // Only super_admin can update other companies' branding
      if (role !== 'super_admin' && targetCompanyId !== company_id) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }
    } else {
      // Update current user's company branding
      if (company_id === null) {
        res.status(400).json({ success: false, message: 'No company associated with user' });
        return;
      }
      targetCompanyId = company_id;
    }

    // Verify company exists
    const company = await prisma.companies.findUnique({
      where: { id: targetCompanyId }
    });

    if (!company) {
      res.status(404).json({ success: false, message: 'Company not found' });
      return;
    }

    // Build update data
    const updateData: any = {};

    if (logo_filename !== undefined) updateData.logo_filename = logo_filename;
    if (panel_name !== undefined) updateData.panel_name = panel_name;
    if (header_color !== undefined) updateData.header_color = header_color;
    if (menu_color !== undefined) updateData.menu_color = menu_color;
    if (login_bg_color !== undefined) updateData.login_bg_color = login_bg_color;

    const updated = await prisma.companies.update({
      where: { id: targetCompanyId },
      data: updateData,
      select: {
        id: true,
        name: true,
        logo_filename: true,
        panel_name: true,
        header_color: true,
        menu_color: true,
        login_bg_color: true,
      }
    });

    logger.info(`Branding updated for company ${targetCompanyId}`);
    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Update branding error:', error);
    res.status(500).json({ success: false, message: 'Failed to update branding' });
  }
};

/**
 * Get all URL mappings for a company
 */
export const getURLMappings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { companyId } = req.query;

    let where: any = {};

    if (role === 'super_admin') {
      if (companyId) {
        where.company_id = Number(companyId);
      }
      // Otherwise, super_admin sees all mappings
    } else if (company_id !== null) {
      where.company_id = company_id;
    } else {
      res.status(400).json({ success: false, message: 'No company associated with user' });
      return;
    }

    const mappings = await prisma.company_url_mappings.findMany({
      where,
      include: {
        companies: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    res.json({ success: true, data: mappings });
  } catch (error) {
    logger.error('Get URL mappings error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch URL mappings' });
  }
};

/**
 * Get single URL mapping
 */
export const getURLMapping = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    let where: any = { id: Number(id) };

    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
    }

    const mapping = await prisma.company_url_mappings.findFirst({
      where,
      include: {
        companies: true
      }
    });

    if (!mapping) {
      res.status(404).json({ success: false, message: 'URL mapping not found' });
      return;
    }

    res.json({ success: true, data: mapping });
  } catch (error) {
    logger.error('Get URL mapping error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch URL mapping' });
  }
};

/**
 * Create URL mapping
 */
export const createURLMapping = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      company_id: reqCompanyId,
      url_pattern,
      is_active,
      ssl_enabled,
      ssl_certificate,
      ssl_private_key,
      ssl_chain,
      use_letsencrypt,
      letsencrypt_email
    } = req.body;

    const { role, company_id: userCompanyId } = req.user!;

    if (!url_pattern) {
      res.status(400).json({ success: false, message: 'URL pattern is required' });
      return;
    }

    // Determine company_id
    let finalCompanyId: number;
    if (role === 'super_admin') {
      if (!reqCompanyId) {
        res.status(400).json({ success: false, message: 'Company ID is required for super admin' });
        return;
      }
      finalCompanyId = reqCompanyId;
    } else {
      if (userCompanyId === null) {
        res.status(400).json({ success: false, message: 'No company associated with user' });
        return;
      }
      finalCompanyId = userCompanyId;
    }

    // Check if URL pattern already exists
    const existing = await prisma.company_url_mappings.findUnique({
      where: { url_pattern }
    });

    if (existing) {
      res.status(400).json({ success: false, message: 'URL pattern already exists' });
      return;
    }

    // Verify company exists
    const company = await prisma.companies.findUnique({
      where: { id: finalCompanyId }
    });

    if (!company) {
      res.status(404).json({ success: false, message: 'Company not found' });
      return;
    }

    const mapping = await prisma.company_url_mappings.create({
      data: {
        company_id: finalCompanyId,
        url_pattern,
        is_active: is_active !== undefined ? is_active : true,
        ssl_enabled: ssl_enabled || false,
        ssl_certificate,
        ssl_private_key,
        ssl_chain,
        use_letsencrypt: use_letsencrypt || false,
        letsencrypt_email,
        ssl_status: ssl_enabled ? 'pending' : undefined
      },
      include: {
        companies: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    logger.info(`URL mapping created: ${mapping.id} for company ${finalCompanyId}`);
    res.status(201).json({ success: true, data: mapping });
  } catch (error) {
    logger.error('Create URL mapping error:', error);
    res.status(500).json({ success: false, message: 'Failed to create URL mapping' });
  }
};

/**
 * Update URL mapping
 */
export const updateURLMapping = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    // Check if mapping exists and user has access
    let where: any = { id: Number(id) };
    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
    }

    const existing = await prisma.company_url_mappings.findFirst({ where });
    if (!existing) {
      res.status(404).json({ success: false, message: 'URL mapping not found or access denied' });
      return;
    }

    // Build update data
    const updateData: any = {};
    const allowedFields = [
      'url_pattern',
      'is_active',
      'ssl_enabled',
      'ssl_certificate',
      'ssl_private_key',
      'ssl_chain',
      'use_letsencrypt',
      'letsencrypt_email'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    const updated = await prisma.company_url_mappings.update({
      where: { id: Number(id) },
      data: updateData,
      include: {
        companies: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    logger.info(`URL mapping updated: ${id}`);
    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Update URL mapping error:', error);
    res.status(500).json({ success: false, message: 'Failed to update URL mapping' });
  }
};

/**
 * Delete URL mapping
 */
export const deleteURLMapping = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    // Check if mapping exists and user has access
    let where: any = { id: Number(id) };
    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
    }

    const existing = await prisma.company_url_mappings.findFirst({ where });
    if (!existing) {
      res.status(404).json({ success: false, message: 'URL mapping not found or access denied' });
      return;
    }

    await prisma.company_url_mappings.delete({
      where: { id: Number(id) }
    });

    logger.info(`URL mapping deleted: ${id}`);
    res.json({ success: true, message: 'URL mapping deleted successfully' });
  } catch (error) {
    logger.error('Delete URL mapping error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete URL mapping' });
  }
};
