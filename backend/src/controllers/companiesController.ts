// Companies controller - CRUD operations
import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middlewares/auth';
import logger from '../utils/logger';

export const getCompanies = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;

    let companies;
    if (role === 'super_admin') {
      companies = await prisma.companies.findMany({
        orderBy: { created_at: 'desc' },
      });
    } else {
      companies = await prisma.companies.findMany({
        where: { id: company_id! },
      });
    }

    res.json({ success: true, data: companies });
  } catch (error) {
    logger.error('Get companies error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch companies' });
  }
};

export const createCompany = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, contact_email, contact_phone, address } = req.body;

    if (!name) {
      res.status(400).json({ success: false, message: 'Company name required' });
      return;
    }

    const company = await prisma.companies.create({
      data: {
        name,
        owner_name: name,
        primary_email: contact_email,
        contact_email,
        contact_phone,
        address,
      },
    });

    res.status(201).json({ success: true, data: company });
  } catch (error) {
    logger.error('Create company error:', error);
    res.status(500).json({ success: false, message: 'Failed to create company' });
  }
};
