import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middlewares/auth';
import { hashPassword } from '../utils/password';
import logger from '../utils/logger';

export const getUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    let users;
    if (role === 'super_admin') {
      users = await prisma.users.findMany({
        select: {
          id: true, username: true, email: true, role: true,
          company_id: true, two_factor_enabled: true, two_factor_required: true,
          created_at: true, updated_at: true,
        },
        orderBy: { created_at: 'desc' },
      });
    } else {
      users = await prisma.users.findMany({
        where: company_id !== null ? { company_id } : {},
        select: {
          id: true, username: true, email: true, role: true,
          company_id: true, two_factor_enabled: true, two_factor_required: true,
          created_at: true, updated_at: true,
        },
        orderBy: { created_at: 'desc' },
      });
    }
    res.json({ success: true, data: users });
  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
};

export const getUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;
    const user = await prisma.users.findUnique({
      where: { id: Number(id) },
      select: {
        id: true, username: true, email: true, role: true,
        company_id: true, two_factor_enabled: true, two_factor_required: true,
        created_at: true, updated_at: true,
      },
    });
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    if (role !== 'super_admin' && user.company_id !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }
    res.json({ success: true, data: user });
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user' });
  }
};

export const createUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { username, email, password, role, company_id, two_factor_required } = req.body;
    const currentUser = req.user!;
    if (!username || !email || !password || !role) {
      res.status(400).json({ success: false, message: 'Missing required fields' });
      return;
    }
    if (currentUser.role !== 'super_admin' && currentUser.role !== 'company_admin') {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }
    const targetCompanyId = currentUser.role === 'super_admin' ? company_id : currentUser.company_id;
    const existing = await prisma.users.findFirst({
      where: { OR: [{ username }, { email }] },
    });
    if (existing) {
      res.status(400).json({
        success: false,
        message: existing.username === username ? 'Username already exists' : 'Email already exists',
      });
      return;
    }
    const password_hash = await hashPassword(password);

    // Prepare user data with optional 2FA requirement
    const userData: any = {
      username,
      email,
      password_hash,
      role,
      company_id: targetCompanyId,
    };

    // Only super_admin and company_admin can set two_factor_required
    if (two_factor_required !== undefined && (currentUser.role === 'super_admin' || currentUser.role === 'company_admin')) {
      userData.two_factor_required = two_factor_required;
    }

    const user = await prisma.users.create({
      data: userData,
      select: {
        id: true, username: true, email: true, role: true,
        company_id: true, two_factor_enabled: true, two_factor_required: true,
        created_at: true, updated_at: true,
      },
    });
    res.status(201).json({ success: true, data: user });
  } catch (error) {
    logger.error('Create user error:', error);
    res.status(500).json({ success: false, message: 'Failed to create user' });
  }
};

export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { username, email, password, role, company_id, two_factor_required } = req.body;
    const currentUser = req.user!;
    const existing = await prisma.users.findUnique({ where: { id: Number(id) } });
    if (!existing) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    if (currentUser.role !== 'super_admin' && existing.company_id !== currentUser.company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }
    if (currentUser.role === 'company_admin' && company_id && company_id !== currentUser.company_id) {
      res.status(403).json({ success: false, message: 'Cannot move user to different company' });
      return;
    }
    if (username || email) {
      const duplicate = await prisma.users.findFirst({
        where: {
          OR: [
            ...(username ? [{ username }] : []),
            ...(email ? [{ email }] : []),
          ],
          id: { not: Number(id) },
        },
      });
      if (duplicate) {
        res.status(400).json({
          success: false,
          message: duplicate.username === username ? 'Username already exists' : 'Email already exists',
        });
        return;
      }
    }
    const updateData: any = {};
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (password) updateData.password_hash = await hashPassword(password);
    if (role) updateData.role = role;
    if (company_id !== undefined && currentUser.role === 'super_admin') {
      updateData.company_id = company_id;
    }

    // Only super_admin and company_admin can modify two_factor_required
    if (two_factor_required !== undefined && (currentUser.role === 'super_admin' || currentUser.role === 'company_admin')) {
      updateData.two_factor_required = two_factor_required;
    }

    const user = await prisma.users.update({
      where: { id: Number(id) },
      data: updateData,
      select: {
        id: true, username: true, email: true, role: true,
        company_id: true, two_factor_enabled: true, two_factor_required: true,
        created_at: true, updated_at: true,
      },
    });
    res.json({ success: true, data: user });
  } catch (error) {
    logger.error('Update user error:', error);
    res.status(500).json({ success: false, message: 'Failed to update user' });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const currentUser = req.user!;
    const user = await prisma.users.findUnique({ where: { id: Number(id) } });
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    if (currentUser.role !== 'super_admin' && user.company_id !== currentUser.company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }
    if (Number(id) === currentUser.id) {
      res.status(400).json({ success: false, message: 'Cannot delete your own account' });
      return;
    }
    await prisma.users.delete({ where: { id: Number(id) } });
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
};
