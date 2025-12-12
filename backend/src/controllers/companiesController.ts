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
        include: {
          _count: { select: { users: true, virtual_machines: true } },
        },
        orderBy: { created_at: 'desc' },
      });
    } else {
      companies = await prisma.companies.findMany({
        where: { id: company_id! },
        include: {
          _count: { select: { users: true, virtual_machines: true } },
        },
      });
    }
    res.json({ success: true, data: companies });
  } catch (error) {
    logger.error('Get companies error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch companies' });
  }
};

export const getCompany = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    // Validate id parameter
    if (!id || isNaN(Number(id))) {
      res.status(400).json({ success: false, message: 'Invalid company ID' });
      return;
    }

    const companyId = Number(id);

    if (role !== 'super_admin' && companyId !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }
    const company = await prisma.companies.findUnique({
      where: { id: companyId },
      include: {
        _count: { select: { users: true, virtual_machines: true } },
      },
    });
    if (!company) {
      res.status(404).json({ success: false, message: 'Company not found' });
      return;
    }
    res.json({ success: true, data: company });
  } catch (error) {
    logger.error('Get company error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch company' });
  }
};

export const createCompany = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role } = req.user!;
    if (role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Only super_admin can create companies' });
      return;
    }
    const { name, owner_name, primary_email, contact_email, contact_phone, address } = req.body;
    if (!name) {
      res.status(400).json({ success: false, message: 'Company name required' });
      return;
    }
    const existing = await prisma.companies.findFirst({ where: { name } });
    if (existing) {
      res.status(400).json({ success: false, message: 'Company name already exists' });
      return;
    }
    const company = await prisma.companies.create({
      data: {
        name,
        owner_name: owner_name || name,
        primary_email: primary_email || contact_email,
        contact_email,
        contact_phone,
        address,
        status: 'active',
      },
    });
    res.status(201).json({ success: true, data: company });
  } catch (error) {
    logger.error('Create company error:', error);
    res.status(500).json({ success: false, message: 'Failed to create company' });
  }
};

export const updateCompany = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;
    if (role !== 'super_admin' && Number(id) !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }
    const { name, owner_name, primary_email, contact_email, contact_phone, address, status } = req.body;
    const existing = await prisma.companies.findUnique({ where: { id: Number(id) } });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Company not found' });
      return;
    }
    if (name && name !== existing.name) {
      const duplicate = await prisma.companies.findFirst({
        where: { name, id: { not: Number(id) } },
      });
      if (duplicate) {
        res.status(400).json({ success: false, message: 'Company name already exists' });
        return;
      }
    }
    const updateData: any = {};
    if (name) updateData.name = name;
    if (owner_name) updateData.owner_name = owner_name;
    if (primary_email) updateData.primary_email = primary_email;
    if (contact_email !== undefined) updateData.contact_email = contact_email;
    if (contact_phone !== undefined) updateData.contact_phone = contact_phone;
    if (address !== undefined) updateData.address = address;
    if (status && role === 'super_admin') updateData.status = status;
    const company = await prisma.companies.update({
      where: { id: Number(id) },
      data: updateData,
    });
    res.json({ success: true, data: company });
  } catch (error) {
    logger.error('Update company error:', error);
    res.status(500).json({ success: false, message: 'Failed to update company' });
  }
};

export const deleteCompany = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role } = req.user!;
    if (role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Only super_admin can delete companies' });
      return;
    }
    const company = await prisma.companies.findUnique({
      where: { id: Number(id) },
      include: {
        _count: { select: { users: true, virtual_machines: true } },
      },
    });
    if (!company) {
      res.status(404).json({ success: false, message: 'Company not found' });
      return;
    }
    if (company._count.users > 0) {
      res.status(400).json({
        success: false,
        message: `Cannot delete company with ${company._count.users} users. Please delete or reassign users first.`,
      });
      return;
    }
    if (company._count.virtual_machines > 0) {
      res.status(400).json({
        success: false,
        message: `Cannot delete company with ${company._count.virtual_machines} VMs. Please delete or reassign VMs first.`,
      });
      return;
    }
    await prisma.companies.delete({ where: { id: Number(id) } });
    res.json({ success: true, message: 'Company deleted successfully' });
  } catch (error) {
    logger.error('Delete company error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete company' });
  }
};
