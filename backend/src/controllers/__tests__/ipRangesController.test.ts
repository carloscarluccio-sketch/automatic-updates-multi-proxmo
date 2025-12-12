import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  getIPRanges,
  getIPRange,
  createIPRange,
  updateIPRange,
  deleteIPRange,
  getAvailableIPs,
} from '../controllers/ipRangesController';
import { AuthRequest } from '../middlewares/auth';

// Mock Prisma Client
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    ip_ranges: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    vm_ip_assignments: {
      count: jest.fn(),
    },
    proxmox_clusters: {
      findUnique: jest.fn(),
    },
    companies: {
      findUnique: jest.fn(),
    },
  };
  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
  };
});

const prisma = new PrismaClient();

describe('IP Ranges Controller', () => {
  let mockReq: Partial<AuthRequest>;
  let mockRes: Partial<Response>;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;

  beforeEach(() => {
    statusMock = jest.fn().mockReturnThis();
    jsonMock = jest.fn();

    mockRes = {
      status: statusMock,
      json: jsonMock,
    } as Partial<Response>;

    jest.clearAllMocks();
  });

  describe('getIPRanges', () => {
    it('should return all IP ranges for super_admin', async () => {
      const mockIPRanges = [
        {
          id: 1,
          subnet: '192.168.1.0/24',
          gateway: '192.168.1.1',
          netmask: '255.255.255.0',
          cluster_id: 1,
          company_id: 1,
          ip_type: 'internal' as const,
          vlan_id: null,
          sdn_zone: null,
          sdn_vnet: null,
          description: 'Test range',
          is_shared: false,
          created_at: new Date(),
          updated_at: new Date(),
          companies: { id: 1, name: 'Company A' },
          proxmox_clusters: { id: 1, name: 'Cluster 1', location: 'DC1' },
          _count: { vm_ip_assignments: 5 },
        },
      ];

      (prisma.ip_ranges.findMany as jest.Mock).mockResolvedValue(mockIPRanges);

      mockReq = {
        user: {
          id: 1,
          email: 'admin@test.com',
          username: 'admin',
          role: 'super_admin',
          company_id: 1,
          created_at: new Date(),
          updated_at: new Date(),
        },
        query: {} as any,
      };

      await getIPRanges(mockReq as AuthRequest, mockRes as Response);

      expect(prisma.ip_ranges.findMany).toHaveBeenCalledWith({
        where: {},
        include: expect.objectContaining({
          companies: { select: { id: true, name: true } },
          proxmox_clusters: { select: { id: true, name: true, location: true } },
          _count: { select: { vm_ip_assignments: true } },
        }),
        orderBy: { created_at: 'desc' },
      });
      expect(jsonMock).toHaveBeenCalledWith({ success: true, data: mockIPRanges });
    });

    it('should filter by company_id for non-super_admin', async () => {
      mockReq = {
        user: {
          id: 2,
          email: 'admin2@test.com',
          username: 'admin2',
          role: 'company_admin',
          company_id: 2,
          created_at: new Date(),
          updated_at: new Date(),
        },
        query: {} as any,
      };

      (prisma.ip_ranges.findMany as jest.Mock).mockResolvedValue([]);

      await getIPRanges(mockReq as AuthRequest, mockRes as Response);

      expect(prisma.ip_ranges.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { company_id: 2 },
        })
      );
    });

    it('should return 403 for user with null company_id', async () => {
      mockReq = {
        user: {
          id: 3,
          email: 'user3@test.com',
          username: 'user3',
          role: 'company_admin',
          company_id: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
        query: {} as any,
      };

      await getIPRanges(mockReq as AuthRequest, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({ success: false, message: 'Access denied' });
    });

    it('should apply cluster_id filter from query params', async () => {
      mockReq = {
        user: {
          id: 1,
          email: 'admin@test.com',
          username: 'admin',
          role: 'super_admin',
          company_id: 1,
          created_at: new Date(),
          updated_at: new Date(),
        },
        query: { cluster_id: '2' } as any,
      };

      (prisma.ip_ranges.findMany as jest.Mock).mockResolvedValue([]);

      await getIPRanges(mockReq as AuthRequest, mockRes as Response);

      expect(prisma.ip_ranges.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { cluster_id: 2 },
        })
      );
    });

    it('should apply ip_type filter from query params', async () => {
      mockReq = {
        user: {
          id: 1,
          email: 'admin@test.com',
          username: 'admin',
          role: 'super_admin',
          company_id: 1,
          created_at: new Date(),
          updated_at: new Date(),
        },
        query: { ip_type: 'external' } as any,
      };

      (prisma.ip_ranges.findMany as jest.Mock).mockResolvedValue([]);

      await getIPRanges(mockReq as AuthRequest, mockRes as Response);

      expect(prisma.ip_ranges.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { ip_type: 'external' },
        })
      );
    });

    it('should handle database errors', async () => {
      mockReq = {
        user: {
          id: 1,
          email: 'admin@test.com',
          username: 'admin',
          role: 'super_admin',
          company_id: 1,
          created_at: new Date(),
          updated_at: new Date(),
        },
        query: {} as any,
      };

      (prisma.ip_ranges.findMany as jest.Mock).mockRejectedValue(new Error('DB Error'));

      await getIPRanges(mockReq as AuthRequest, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ success: false, message: 'Failed to fetch IP ranges' });
    });
  });

  describe('createIPRange', () => {
    it('should create IP range with valid data for super_admin', async () => {
      const mockCluster = { id: 1, name: 'Cluster 1' };
      const mockCompany = { id: 1, name: 'Company A' };
      const mockCreatedRange = {
        id: 1,
        subnet: '10.0.1.0/24',
        gateway: '10.0.1.1',
        netmask: '255.255.255.0',
        cluster_id: 1,
        company_id: 1,
        ip_type: 'internal' as const,
        vlan_id: null,
        sdn_zone: null,
        sdn_vnet: null,
        description: null,
        is_shared: false,
        created_at: new Date(),
        updated_at: new Date(),
        companies: mockCompany,
        proxmox_clusters: mockCluster,
      };

      (prisma.proxmox_clusters.findUnique as jest.Mock).mockResolvedValue(mockCluster);
      (prisma.companies.findUnique as jest.Mock).mockResolvedValue(mockCompany);
      (prisma.ip_ranges.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.ip_ranges.create as jest.Mock).mockResolvedValue(mockCreatedRange);

      mockReq = {
        user: {
          id: 1,
          email: 'admin@test.com',
          username: 'admin',
          role: 'super_admin',
          company_id: 1,
          created_at: new Date(),
          updated_at: new Date(),
        },
        body: {
          subnet: '10.0.1.0/24',
          gateway: '10.0.1.1',
          cluster_id: 1,
          company_id: 1,
          ip_type: 'internal',
        },
      };

      await createIPRange(mockReq as AuthRequest, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({ success: true, data: mockCreatedRange });
    });

    it('should return 400 if subnet or cluster_id missing', async () => {
      mockReq = {
        user: {
          id: 1,
          email: 'admin@test.com',
          username: 'admin',
          role: 'super_admin',
          company_id: 1,
          created_at: new Date(),
          updated_at: new Date(),
        },
        body: { gateway: '10.0.1.1' },
      };

      await createIPRange(mockReq as AuthRequest, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: 'Subnet and cluster ID are required',
      });
    });

    it('should return 404 if cluster not found', async () => {
      (prisma.proxmox_clusters.findUnique as jest.Mock).mockResolvedValue(null);

      mockReq = {
        user: {
          id: 1,
          email: 'admin@test.com',
          username: 'admin',
          role: 'super_admin',
          company_id: 1,
          created_at: new Date(),
          updated_at: new Date(),
        },
        body: {
          subnet: '10.0.1.0/24',
          cluster_id: 999,
        },
      };

      await createIPRange(mockReq as AuthRequest, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ success: false, message: 'Cluster not found' });
    });

    it('should return 400 if duplicate subnet exists in cluster', async () => {
      const mockCluster = { id: 1, name: 'Cluster 1' };
      const existingRange = { id: 2, subnet: '10.0.1.0/24', cluster_id: 1 };

      (prisma.proxmox_clusters.findUnique as jest.Mock).mockResolvedValue(mockCluster);
      (prisma.ip_ranges.findFirst as jest.Mock).mockResolvedValue(existingRange);

      mockReq = {
        user: {
          id: 1,
          email: 'admin@test.com',
          username: 'admin',
          role: 'super_admin',
          company_id: 1,
          created_at: new Date(),
          updated_at: new Date(),
        },
        body: {
          subnet: '10.0.1.0/24',
          cluster_id: 1,
          company_id: 1,
        },
      };

      await createIPRange(mockReq as AuthRequest, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: 'IP range with this subnet already exists for this cluster',
      });
    });

    it('should use user company_id for non-super_admin', async () => {
      const mockCluster = { id: 1, name: 'Cluster 1' };
      const mockCompany = { id: 2, name: 'Company B' };

      (prisma.proxmox_clusters.findUnique as jest.Mock).mockResolvedValue(mockCluster);
      (prisma.companies.findUnique as jest.Mock).mockResolvedValue(mockCompany);
      (prisma.ip_ranges.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.ip_ranges.create as jest.Mock).mockResolvedValue({});

      mockReq = {
        user: {
          id: 2,
          email: 'admin2@test.com',
          username: 'admin2',
          role: 'company_admin',
          company_id: 2,
          created_at: new Date(),
          updated_at: new Date(),
        },
        body: {
          subnet: '10.0.2.0/24',
          cluster_id: 1,
        },
      };

      await createIPRange(mockReq as AuthRequest, mockRes as Response);

      expect(prisma.ip_ranges.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            company_id: 2,
          }),
        })
      );
    });
  });

  describe('deleteIPRange', () => {
    it('should delete IP range if no assignments exist', async () => {
      const mockRange = { id: 1, subnet: '10.0.1.0/24' };

      (prisma.ip_ranges.findFirst as jest.Mock).mockResolvedValue(mockRange);
      (prisma.vm_ip_assignments.count as jest.Mock).mockResolvedValue(0);
      (prisma.ip_ranges.delete as jest.Mock).mockResolvedValue(mockRange);

      mockReq = {
        user: {
          id: 1,
          email: 'admin@test.com',
          username: 'admin',
          role: 'super_admin',
          company_id: 1,
          created_at: new Date(),
          updated_at: new Date(),
        },
        params: { id: '1' } as any,
      };

      await deleteIPRange(mockReq as AuthRequest, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: 'IP range deleted successfully',
      });
    });

    it('should return 400 if IP range has assigned IPs', async () => {
      const mockRange = { id: 1, subnet: '10.0.1.0/24' };

      (prisma.ip_ranges.findFirst as jest.Mock).mockResolvedValue(mockRange);
      (prisma.vm_ip_assignments.count as jest.Mock).mockResolvedValue(3);

      mockReq = {
        user: {
          id: 1,
          email: 'admin@test.com',
          username: 'admin',
          role: 'super_admin',
          company_id: 1,
          created_at: new Date(),
          updated_at: new Date(),
        },
        params: { id: '1' } as any,
      };

      await deleteIPRange(mockReq as AuthRequest, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: 'Cannot delete IP range with 3 assigned IPs. Please remove IP assignments first.',
      });
    });

    it('should return 404 if IP range not found', async () => {
      (prisma.ip_ranges.findFirst as jest.Mock).mockResolvedValue(null);

      mockReq = {
        user: {
          id: 1,
          email: 'admin@test.com',
          username: 'admin',
          role: 'super_admin',
          company_id: 1,
          created_at: new Date(),
          updated_at: new Date(),
        },
        params: { id: '999' } as any,
      };

      await deleteIPRange(mockReq as AuthRequest, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ success: false, message: 'IP range not found' });
    });

    it('should respect company_id for non-super_admin', async () => {
      mockReq = {
        user: {
          id: 2,
          email: 'admin2@test.com',
          username: 'admin2',
          role: 'company_admin',
          company_id: 2,
          created_at: new Date(),
          updated_at: new Date(),
        },
        params: { id: '1' } as any,
      };

      (prisma.ip_ranges.findFirst as jest.Mock).mockResolvedValue(null);

      await deleteIPRange(mockReq as AuthRequest, mockRes as Response);

      expect(prisma.ip_ranges.findFirst).toHaveBeenCalledWith({
        where: { id: 1, company_id: 2 },
      });
    });
  });

  describe('getAvailableIPs', () => {
    it('should return assigned IPs count and list', async () => {
      const mockRange = {
        id: 1,
        subnet: '10.0.1.0/24',
        gateway: '10.0.1.1',
        vm_ip_assignments: [
          { ip_address: '10.0.1.10' },
          { ip_address: '10.0.1.11' },
        ],
      };

      (prisma.ip_ranges.findFirst as jest.Mock).mockResolvedValue(mockRange);

      mockReq = {
        user: {
          id: 1,
          email: 'admin@test.com',
          username: 'admin',
          role: 'super_admin',
          company_id: 1,
          created_at: new Date(),
          updated_at: new Date(),
        },
        params: { id: '1' } as any,
      };

      await getAvailableIPs(mockReq as AuthRequest, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          subnet: '10.0.1.0/24',
          gateway: '10.0.1.1',
          assigned_count: 2,
          assigned_ips: ['10.0.1.10', '10.0.1.11'],
        },
      });
    });

    it('should return 404 if IP range not found', async () => {
      (prisma.ip_ranges.findFirst as jest.Mock).mockResolvedValue(null);

      mockReq = {
        user: {
          id: 1,
          email: 'admin@test.com',
          username: 'admin',
          role: 'super_admin',
          company_id: 1,
          created_at: new Date(),
          updated_at: new Date(),
        },
        params: { id: '999' } as any,
      };

      await getAvailableIPs(mockReq as AuthRequest, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ success: false, message: 'IP range not found' });
    });
  });

  describe('updateIPRange', () => {
    it('should update IP range with valid data', async () => {
      const existingRange = { id: 1, subnet: '10.0.1.0/24', cluster_id: 1 };
      const updatedRange = { ...existingRange, description: 'Updated' };

      (prisma.ip_ranges.findFirst as jest.Mock).mockResolvedValue(existingRange);
      (prisma.ip_ranges.update as jest.Mock).mockResolvedValue(updatedRange);

      mockReq = {
        user: {
          id: 1,
          email: 'admin@test.com',
          username: 'admin',
          role: 'super_admin',
          company_id: 1,
          created_at: new Date(),
          updated_at: new Date(),
        },
        params: { id: '1' } as any,
        body: { description: 'Updated' },
      };

      await updateIPRange(mockReq as AuthRequest, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({ success: true, data: updatedRange });
    });

    it('should check for duplicate subnet when changing subnet', async () => {
      const existingRange = { id: 1, subnet: '10.0.1.0/24', cluster_id: 1 };
      const duplicateRange = { id: 2, subnet: '10.0.2.0/24', cluster_id: 1 };

      (prisma.ip_ranges.findFirst as jest.Mock)
        .mockResolvedValueOnce(existingRange)
        .mockResolvedValueOnce(duplicateRange);

      mockReq = {
        user: {
          id: 1,
          email: 'admin@test.com',
          username: 'admin',
          role: 'super_admin',
          company_id: 1,
          created_at: new Date(),
          updated_at: new Date(),
        },
        params: { id: '1' } as any,
        body: { subnet: '10.0.2.0/24' },
      };

      await updateIPRange(mockReq as AuthRequest, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: 'IP range with this subnet already exists for this cluster',
      });
    });
  });
});
