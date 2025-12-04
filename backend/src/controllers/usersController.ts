// Users controller - CRUD operations
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
          id: true,
          username: true,
          email: true,
          role: true,
          company_id: true,
          created_at: true,
        },
        orderBy: { created_at: 'desc' },
      });
    } else {
      users = await prisma.users.findMany({
        where: company_id !== null ? { company_id } : {},
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          company_id: true,
          created_at: true,
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

export const createUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { username, email, password, role, company_id } = req.body;
    const currentUser = req.user!;

    // Validation
    if (!username || !email || !password || !role) {
      res.status(400).json({ success: false, message: 'Missing required fields' });
      return;
    }

    // Authorization check
    if (currentUser.role !== 'super_admin' && currentUser.role !== 'company_admin') {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    // Company admin can only create users in their company
    const targetCompanyId =
      currentUser.role === 'super_admin'
        ? company_id
        : currentUser.company_id;

    // Hash password
    const password_hash = await hashPassword(password);

    // Create user
    const user = await prisma.users.create({
      data: {
        username,
        email,
        password_hash,
        role,
        company_id: targetCompanyId,
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        company_id: true,
        created_at: true,
      },
    });

    res.status(201).json({ success: true, data: user });
  } catch (error) {
    logger.error('Create user error:', error);
    res.status(500).json({ success: false, message: 'Failed to create user' });
  }
};
