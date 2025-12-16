import { Request, Response } from 'express';
import prisma from '../config/database';
import logger from '../utils/logger';

/**
 * Get default company branding for login page (NO AUTH)
 * Returns company ID 1 (System Admin) branding as default
 */
export const getDefaultBranding = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Get first company's branding as default
    const company = await prisma.companies.findFirst({
      where: { id: 1 },
      select: {
        id: true,
        name: true,
        logo_filename: true,
          favicon_filename: true,
        panel_name: true,
        header_color: true,
        menu_color: true,
        login_bg_color: true,
        primary_color: true,
        secondary_color: true,
        background_color: true,
        text_color: true,
        font_family: true,
        sidebar_text_color: true
      }
    });

    if (!company) {
      // Return defaults if no company found
      res.json({
        success: true,
        data: {
          panel_name: 'Proxmox Multi-Tenant',
          logo_filename: null,
          login_bg_color: '#1a1a2e'
        }
      });
      return;
    }

    res.json({ success: true, data: company });
  } catch (error) {
    logger.error('Get default branding error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch branding' });
  }
};
