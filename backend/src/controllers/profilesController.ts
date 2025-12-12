import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../config/database';
import logger from '../utils/logger';

/**
 * Get all user profiles
 */
export const getProfiles = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;

    let where: any = {};

    if (role === 'super_admin') {
      // Super admin can see all profiles or filter by company
      if (req.query.company_id) {
        where.company_id = Number(req.query.company_id);
      }
    } else if (company_id !== null) {
      // Regular users see company profiles + system profiles
      where = {
        OR: [
          { company_id },
          { is_system: true }
        ]
      };
    } else {
      res.status(400).json({ success: false, message: 'No company associated with user' });
      return;
    }

    const profiles = await prisma.user_profiles.findMany({
      where,
      include: {
        companies: {
          select: { id: true, name: true }
        },
        profile_permissions: {
          include: {
            permissions: {
              select: {
                id: true,
                code: true,
                name: true,
                category: true
              }
            }
          }
        },
        _count: {
          select: {
            users_users_profile_idTouser_profiles: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    res.json({ success: true, data: profiles });
  } catch (error) {
    logger.error('Get profiles error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch profiles' });
  }
};

/**
 * Get single profile by ID
 */
export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    let where: any = { id: Number(id) };

    if (role !== 'super_admin' && company_id !== null) {
      where = {
        id: Number(id),
        OR: [
          { company_id },
          { is_system: true }
        ]
      };
    }

    const profile = await prisma.user_profiles.findFirst({
      where,
      include: {
        companies: {
          select: { id: true, name: true }
        },
        profile_permissions: {
          include: {
            permissions: {
              select: {
                id: true,
                code: true,
                name: true,
                description: true,
                category: true
              }
            }
          }
        },
        _count: {
          select: {
            users_users_profile_idTouser_profiles: true
          }
        }
      }
    });

    if (!profile) {
      res.status(404).json({ success: false, message: 'Profile not found or access denied' });
      return;
    }

    res.json({ success: true, data: profile });
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
};

/**
 * Create new profile
 */
export const createProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      name,
      description,
      permission_ids
    } = req.body;

    const { role, company_id, id: userId } = req.user!;

    if (!name) {
      res.status(400).json({ success: false, message: 'Profile name is required' });
      return;
    }

    // Determine company_id
    let finalCompanyId: number | null = null;
    let isSystem = false;

    if (role === 'super_admin') {
      if (req.body.company_id) {
        finalCompanyId = req.body.company_id;
      }
      isSystem = req.body.is_system || false;
    } else if (company_id !== null) {
      finalCompanyId = company_id;
      isSystem = false;
    } else {
      res.status(400).json({ success: false, message: 'No company associated with user' });
      return;
    }

    // Check for duplicate name
    const existing = await prisma.user_profiles.findFirst({
      where: { name }
    });

    if (existing) {
      res.status(400).json({ success: false, message: 'Profile name already exists' });
      return;
    }

    // Create profile
    const profile = await prisma.user_profiles.create({
      data: {
        name,
        description: description || null,
        company_id: finalCompanyId,
        is_system: isSystem,
        created_by: userId
      },
      include: {
        companies: {
          select: { id: true, name: true }
        }
      }
    });

    // Add permissions if provided
    if (permission_ids && Array.isArray(permission_ids) && permission_ids.length > 0) {
      await prisma.profile_permissions.createMany({
        data: permission_ids.map((permId: number) => ({
          profile_id: profile.id,
          permission_id: permId
        }))
      });
    }

    // Fetch full profile with permissions
    const fullProfile = await prisma.user_profiles.findUnique({
      where: { id: profile.id },
      include: {
        companies: {
          select: { id: true, name: true }
        },
        profile_permissions: {
          include: {
            permissions: {
              select: {
                id: true,
                code: true,
                name: true,
                category: true
              }
            }
          }
        }
      }
    });

    logger.info(`Profile created: ${profile.id} by user ${userId}`);
    res.status(201).json({ success: true, data: fullProfile });
  } catch (error) {
    logger.error('Create profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to create profile' });
  }
};

/**
 * Update profile
 */
export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    // Check access
    let where: any = { id: Number(id) };
    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
    }

    const existing = await prisma.user_profiles.findFirst({ where });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Profile not found or access denied' });
      return;
    }

    // Prevent modifying system profiles by non-super_admin
    if (existing.is_system && role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Cannot modify system profile' });
      return;
    }

    // Build update data
    const updateData: any = {};

    if (req.body.name !== undefined) updateData.name = req.body.name;
    if (req.body.description !== undefined) updateData.description = req.body.description;

    if (role === 'super_admin') {
      if (req.body.is_system !== undefined) updateData.is_system = req.body.is_system;
      if (req.body.company_id !== undefined) updateData.company_id = req.body.company_id;
    }

    // Update profile
    await prisma.user_profiles.update({
      where: { id: Number(id) },
      data: updateData
    });

    // Update permissions if provided
    if (req.body.permission_ids !== undefined && Array.isArray(req.body.permission_ids)) {
      // Delete existing permissions
      await prisma.profile_permissions.deleteMany({
        where: { profile_id: Number(id) }
      });

      // Add new permissions
      if (req.body.permission_ids.length > 0) {
        await prisma.profile_permissions.createMany({
          data: req.body.permission_ids.map((permId: number) => ({
            profile_id: Number(id),
            permission_id: permId
          }))
        });
      }
    }

    // Fetch full profile with permissions
    const fullProfile = await prisma.user_profiles.findUnique({
      where: { id: Number(id) },
      include: {
        companies: {
          select: { id: true, name: true }
        },
        profile_permissions: {
          include: {
            permissions: {
              select: {
                id: true,
                code: true,
                name: true,
                category: true
              }
            }
          }
        }
      }
    });

    logger.info(`Profile updated: ${id}`);
    res.json({ success: true, data: fullProfile });
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
};

/**
 * Delete profile
 */
export const deleteProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    // Check access
    let where: any = { id: Number(id) };
    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
    }

    const existing = await prisma.user_profiles.findFirst({
      where,
      include: {
        _count: {
          select: {
            users_users_profile_idTouser_profiles: true
          }
        }
      }
    });

    if (!existing) {
      res.status(404).json({ success: false, message: 'Profile not found or access denied' });
      return;
    }

    // Prevent deleting system profiles
    if (existing.is_system) {
      res.status(403).json({ success: false, message: 'Cannot delete system profile' });
      return;
    }

    // Prevent deleting profiles with users
    if (existing._count.users_users_profile_idTouser_profiles > 0) {
      res.status(400).json({
        success: false,
        message: `Cannot delete profile. ${existing._count.users_users_profile_idTouser_profiles} user(s) are assigned to this profile.`
      });
      return;
    }

    await prisma.user_profiles.delete({
      where: { id: Number(id) }
    });

    logger.info(`Profile deleted: ${id}`);
    res.json({ success: true, message: 'Profile deleted successfully' });
  } catch (error) {
    logger.error('Delete profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete profile' });
  }
};

/**
 * Get all available permissions
 */
export const getPermissions = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const permissions = await prisma.permissions.findMany({
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    });

    res.json({ success: true, data: permissions });
  } catch (error) {
    logger.error('Get permissions error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch permissions' });
  }
};
