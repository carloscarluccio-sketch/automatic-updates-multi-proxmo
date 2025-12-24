import { Request, Response } from 'express';
import logger from '../utils/logger';
import ProxmoxPackageService from '../services/esxi/ProxmoxPackageService';

/**
 * Check if pve-esxi-import-tools is installed on a cluster
 * GET /api/clusters/:id/check-esxi-tools
 */
export const checkESXiTools = async (req: Request, res: Response): Promise<void> => {
  try {
    const clusterId = parseInt(req.params.id);
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    logger.info(`Checking ESXi import tools for cluster ${clusterId} by user ${user.id}`);

    const packageService = new ProxmoxPackageService(clusterId);
    const status = await packageService.checkESXiImportTools();

    res.json({
      success: true,
      data: status
    });
  } catch (error: any) {
    logger.error('Failed to check ESXi import tools:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to check package status'
    });
  }
};

/**
 * Install pve-esxi-import-tools on a cluster
 * POST /api/clusters/:id/install-esxi-tools
 */
export const installESXiTools = async (req: Request, res: Response): Promise<void> => {
  console.log('=== INSTALL FUNCTION CALLED ===');
  console.log('Request params:', req.params);
  console.log('User:', (req as any).user);

  try {
    const clusterId = parseInt(req.params.id);
    const user = (req as any).user;

    console.log('Parsed cluster ID:', clusterId);
    console.log('User role:', user?.role);

    if (!user) {
      console.log('No user found, returning 401');
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    // Only super_admin can install packages
    if (user.role !== 'super_admin') {
      console.log('User is not super_admin, returning 403');
      res.status(403).json({
        success: false,
        message: 'Only super administrators can install packages'
      });
      return;
    }

    logger.info(`Installing ESXi import tools on cluster ${clusterId} by user ${user.id}`);
    console.log('About to create ProxmoxPackageService...');

    const packageService = new ProxmoxPackageService(clusterId);
    console.log('ProxmoxPackageService created successfully');

    console.log('About to call installESXiImportTools...');
    const result = await packageService.installESXiImportTools();
    console.log('installESXiImportTools result:', result);

    if (result.status === 'completed') {
      res.json({
        success: true,
        data: result
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message,
        data: result
      });
    }
  } catch (error: any) {
    console.error('=== INSTALL ERROR ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    logger.error('Failed to install ESXi import tools:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to install package'
    });
  }
};
