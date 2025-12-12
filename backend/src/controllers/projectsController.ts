import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth';
import logger from '../utils/logger';

const prisma = new PrismaClient();

export const getProjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { company_id: queryCompanyId } = req.query;

    let where: any = {};

    // Apply company filtering based on role
    if (role !== 'super_admin') {
      // Non-super_admin can only see their company's projects
      if (company_id === null) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }
      where.company_id = company_id;
    } else if (queryCompanyId) {
      // Super_admin can filter by company_id if provided
      where.company_id = Number(queryCompanyId);
    }

    const projects = await prisma.vm_projects.findMany({
      where,
      include: {
        companies: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            virtual_machines: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    res.json({ success: true, data: projects });
  } catch (error) {
    logger.error('Get projects error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch projects' });
  }
};

export const getProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    let where: any = { id: Number(id) };

    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
    }

    const project = await prisma.vm_projects.findFirst({
      where,
      include: {
        companies: {
          select: {
            id: true,
            name: true,
          },
        },
        virtual_machines: {
          select: {
            id: true,
            name: true,
            vmid: true,
            node: true,
            status: true,
            cpu_cores: true,
            memory_mb: true,
          },
        },
        _count: {
          select: {
            virtual_machines: true,
          },
        },
      },
    });

    if (!project) {
      res.status(404).json({ success: false, message: 'Project not found' });
      return;
    }

    res.json({ success: true, data: project });
  } catch (error) {
    logger.error('Get project error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch project' });
  }
};

export const createProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const {
      name,
      description,
      company_id: requestCompanyId,
    } = req.body;

    // Validate required fields
    if (!name) {
      res.status(400).json({ success: false, message: 'Project name is required' });
      return;
    }

    // Determine company_id based on role
    let finalCompanyId: number;
    if (role === 'super_admin') {
      if (!requestCompanyId) {
        res.status(400).json({ success: false, message: 'Company ID is required for super_admin' });
        return;
      }
      finalCompanyId = Number(requestCompanyId);
    } else {
      if (company_id === null) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }
      finalCompanyId = company_id;
    }

    // Check if company exists
    const company = await prisma.companies.findUnique({
      where: { id: finalCompanyId },
    });

    if (!company) {
      res.status(404).json({ success: false, message: 'Company not found' });
      return;
    }

    // Check for duplicate project name within the same company
    const existingProject = await prisma.vm_projects.findFirst({
      where: {
        company_id: finalCompanyId,
        name,
      },
    });

    if (existingProject) {
      res.status(400).json({ success: false, message: 'Project name already exists for this company' });
      return;
    }

    const project = await prisma.vm_projects.create({
      data: {
        name,
        description,
        company_id: finalCompanyId,
      },
      include: {
        companies: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.status(201).json({ success: true, data: project });
  } catch (error) {
    logger.error('Create project error:', error);
    res.status(500).json({ success: false, message: 'Failed to create project' });
  }
};

export const updateProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;
    const {
      name,
      description,
    } = req.body;

    // Check permission
    let where: any = { id: Number(id) };
    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
    }

    const existingProject = await prisma.vm_projects.findFirst({ where });
    if (!existingProject) {
      res.status(404).json({ success: false, message: 'Project not found' });
      return;
    }

    // Check for duplicate name if name is being changed
    if (name && name !== existingProject.name) {
      const duplicateProject = await prisma.vm_projects.findFirst({
        where: {
          company_id: existingProject.company_id,
          name,
          id: { not: Number(id) },
        },
      });

      if (duplicateProject) {
        res.status(400).json({ success: false, message: 'Project name already exists for this company' });
        return;
      }
    }

    // Build update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;

    const project = await prisma.vm_projects.update({
      where: { id: Number(id) },
      data: updateData,
      include: {
        companies: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            virtual_machines: true,
          },
        },
      },
    });

    res.json({ success: true, data: project });
  } catch (error) {
    logger.error('Update project error:', error);
    res.status(500).json({ success: false, message: 'Failed to update project' });
  }
};

export const deleteProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    // Check permission
    let where: any = { id: Number(id) };
    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
    }

    const project = await prisma.vm_projects.findFirst({ where });
    if (!project) {
      res.status(404).json({ success: false, message: 'Project not found' });
      return;
    }

    // Check if project has VMs
    const vmCount = await prisma.virtual_machines.count({
      where: { project_id: Number(id) },
    });

    if (vmCount > 0) {
      res.status(400).json({
        success: false,
        message: `Cannot delete project with ${vmCount} virtual machines. Please reassign or delete VMs first.`
      });
      return;
    }

    await prisma.vm_projects.delete({
      where: { id: Number(id) },
    });

    res.json({ success: true, message: 'Project deleted successfully' });
  } catch (error) {
    logger.error('Delete project error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete project' });
  }
};
