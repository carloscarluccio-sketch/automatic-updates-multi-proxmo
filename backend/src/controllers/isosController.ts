import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../config/database';
import logger from '../utils/logger';

/**
 * Convert BigInt fields to strings for JSON serialization
 */
function serializeISO(iso: any) {
  return {
    ...iso,
    size_bytes: iso.size_bytes ? iso.size_bytes.toString() : null
  };
}

/**
 * Get all ISOs
 */
export const getISOs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { clusterId } = req.query;

    let where: any = {};

    if (role === 'super_admin') {
      if (clusterId) {
        where.cluster_id = Number(clusterId);
      }
    } else if (company_id !== null) {
      where = {
        OR: [
          { company_id },
          { is_default: true }
        ]
      };
      if (clusterId) {
        where.cluster_id = Number(clusterId);
      }
    } else {
      where.is_default = true;
    }

    const isos = await prisma.isos.findMany({
      where,
      orderBy: { created_at: 'desc' }
    });

    // Serialize BigInt fields
    const serialized = isos.map(serializeISO);

    res.json({ success: true, data: serialized });
  } catch (error) {
    logger.error('Get ISOs error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch ISOs' });
  }
};

/**
 * Get single ISO
 */
export const getISO = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    let where: any = { id: Number(id) };

    if (role !== 'super_admin' && company_id !== null) {
      where = {
        AND: [
          { id: Number(id) },
          {
            OR: [
              { company_id },
              { is_default: true }
            ]
          }
        ]
      };
    }

    const iso = await prisma.isos.findFirst({ where });

    if (!iso) {
      res.status(404).json({ success: false, message: 'ISO not found' });
      return;
    }

    res.json({ success: true, data: serializeISO(iso) });
  } catch (error) {
    logger.error('Get ISO error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch ISO' });
  }
};

/**
 * Create ISO record
 */
export const createISO = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      name,
      filename,
      size_bytes,
      cluster_id,
      storage,
      node,
      is_default,
      description
    } = req.body;

    const { role, company_id, id: userId } = req.user!;

    if (!name || !filename || !cluster_id || !storage) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: name, filename, cluster_id, storage'
      });
      return;
    }

    // Determine company_id
    let finalCompanyId = null;
    if (role === 'super_admin') {
      finalCompanyId = req.body.company_id || null;
    } else {
      finalCompanyId = company_id;
    }

    // Only super_admin can set is_default
    const finalIsDefault = role === 'super_admin' ? (is_default || false) : false;

    const iso = await prisma.isos.create({
      data: {
        name,
        filename,
        size_bytes: size_bytes ? BigInt(size_bytes) : null,
        cluster_id,
        storage,
        node,
        company_id: finalCompanyId,
        is_default: finalIsDefault,
        description,
        uploaded_by: userId
      }
    });

    logger.info(`ISO created: ${iso.id}`);
    res.status(201).json({ success: true, data: serializeISO(iso) });
  } catch (error) {
    logger.error('Create ISO error:', error);
    res.status(500).json({ success: false, message: 'Failed to create ISO' });
  }
};

/**
 * Update ISO
 */
export const updateISO = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    // Check access
    let where: any = { id: Number(id) };
    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
    }

    const existing = await prisma.isos.findFirst({ where });
    if (!existing) {
      res.status(404).json({ success: false, message: 'ISO not found or access denied' });
      return;
    }

    // Build update data
    const updateData: any = {};
    const allowedFields = ['name', 'description', 'node'];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    // Only super_admin can change is_default
    if (role === 'super_admin' && req.body.is_default !== undefined) {
      updateData.is_default = req.body.is_default;
    }

    const updated = await prisma.isos.update({
      where: { id: Number(id) },
      data: updateData
    });

    logger.info(`ISO updated: ${id}`);
    res.json({ success: true, data: serializeISO(updated) });
  } catch (error) {
    logger.error('Update ISO error:', error);
    res.status(500).json({ success: false, message: 'Failed to update ISO' });
  }
};

/**
 * Delete ISO
 */
export const deleteISO = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    // Check access
    let where: any = { id: Number(id) };
    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
    }

    const existing = await prisma.isos.findFirst({ where });
    if (!existing) {
      res.status(404).json({ success: false, message: 'ISO not found or access denied' });
      return;
    }

    // Prevent deletion of default ISOs unless super_admin
    if (existing.is_default && role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Cannot delete default ISO' });
      return;
    }

    await prisma.isos.delete({
      where: { id: Number(id) }
    });

    logger.info(`ISO deleted: ${id}`);
    res.json({ success: true, message: 'ISO deleted successfully' });
  } catch (error) {
    logger.error('Delete ISO error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete ISO' });
  }
};
