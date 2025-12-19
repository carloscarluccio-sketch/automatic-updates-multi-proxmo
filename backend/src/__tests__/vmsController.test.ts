/**
 * Integration tests for VMs Controller
 * Tests VM CRUD operations, Proxmox API integration, power management
 */

import request from 'supertest';
import { app } from '../index';
import { PrismaClient } from '@prisma/client';
import * as jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

describe('VMs Controller', () => {
  let testCompany: any;
  let testUser: any;
  let superAdminUser: any;
  let testCluster: any;
  let userToken: string;
  let adminToken: string;

  beforeAll(async () => {
    // Create test company
    testCompany = await prisma.companies.create({
      data: {
        name: 'Test Company VMs',
        status: 'active',
      },
    });

    // Create regular user
    testUser = await prisma.users.create({
      data: {
        username: 'vmuser',
        email: 'vmuser@example.com',
        password: 'hashedpass',
        role: 'user',
        company_id: testCompany.id,
        status: 'active',
      },
    });

    // Create super admin
    superAdminUser = await prisma.users.create({
      data: {
        username: 'vmsuperadmin',
        email: 'vmsuperadmin@example.com',
        password: 'hashedpass',
        role: 'super_admin',
        status: 'active',
      },
    });

    // Create test cluster
    testCluster = await prisma.proxmox_clusters.create({
      data: {
        name: 'Test Cluster',
        host: '192.168.1.100',
        port: 8006,
        username: 'root@pam',
        password_encrypted: 'encrypted',
        location: 'Test Lab',
      },
    });

    userToken = jwt.sign({ sub: testUser.id }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
    adminToken = jwt.sign({ sub: superAdminUser.id }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
  });

  afterAll(async () => {
    await prisma.virtual_machines.deleteMany({ where: { company_id: testCompany.id } });
    await prisma.users.deleteMany({ where: { id: { in: [testUser.id, superAdminUser.id] } } });
    await prisma.proxmox_clusters.delete({ where: { id: testCluster.id } });
    await prisma.companies.delete({ where: { id: testCompany.id } });
    await prisma.$disconnect();
  });

  describe('GET /api/vms', () => {
    let testVM: any;

    beforeAll(async () => {
      testVM = await prisma.virtual_machines.create({
        data: {
          vmid: 100,
          name: 'test-vm-1',
          company_id: testCompany.id,
          cluster_id: testCluster.id,
          node: 'pve1',
          cores: 2,
          memory: 2048,
          disk: 20,
          status: 'running',
        },
      });
    });

    afterAll(async () => {
      await prisma.virtual_machines.delete({ where: { id: testVM.id } });
    });

    it('should list VMs for authenticated user', async () => {
      const response = await request(app)
        .get('/api/vms')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0]).toMatchObject({
        id: testVM.id,
        name: 'test-vm-1',
        vmid: 100,
        company_id: testCompany.id,
      });
    });

    it('should filter VMs by company for regular users', async () => {
      // Create VM for different company
      const otherCompany = await prisma.companies.create({
        data: { name: 'Other Company', status: 'active' },
      });

      const otherVM = await prisma.virtual_machines.create({
        data: {
          vmid: 101,
          name: 'other-vm',
          company_id: otherCompany.id,
          cluster_id: testCluster.id,
          node: 'pve1',
          cores: 1,
          memory: 1024,
          disk: 10,
        },
      });

      const response = await request(app)
        .get('/api/vms')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      const vmIds = response.body.data.map((vm: any) => vm.id);
      expect(vmIds).toContain(testVM.id);
      expect(vmIds).not.toContain(otherVM.id);

      // Cleanup
      await prisma.virtual_machines.delete({ where: { id: otherVM.id } });
      await prisma.companies.delete({ where: { id: otherCompany.id } });
    });

    it('should show all VMs for super_admin', async () => {
      const response = await request(app)
        .get('/api/vms')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should require authentication', async () => {
      const response = await request(app).get('/api/vms');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/vms', () => {
    it('should create VM with valid data', async () => {
      const response = await request(app)
        .post('/api/vms')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          vmid: 200,
          name: 'new-test-vm',
          cluster_id: testCluster.id,
          node: 'pve1',
          cores: 4,
          memory: 4096,
          disk: 50,
          network: {
            ip: '192.168.1.200',
            gateway: '192.168.1.1',
            netmask: '255.255.255.0',
          },
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        vmid: 200,
        name: 'new-test-vm',
        cores: 4,
        memory: 4096,
      });

      // Cleanup
      await prisma.virtual_machines.delete({ where: { id: response.body.data.id } });
    });

    it('should reject duplicate VMID on same cluster', async () => {
      const existingVM = await prisma.virtual_machines.create({
        data: {
          vmid: 300,
          name: 'existing-vm',
          company_id: testCompany.id,
          cluster_id: testCluster.id,
          node: 'pve1',
          cores: 2,
          memory: 2048,
          disk: 20,
        },
      });

      const response = await request(app)
        .post('/api/vms')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          vmid: 300,
          name: 'duplicate-vmid',
          cluster_id: testCluster.id,
          node: 'pve1',
          cores: 2,
          memory: 2048,
          disk: 20,
        });

      expect(response.status).toBe(409);
      expect(response.body.message).toContain('VMID');

      await prisma.virtual_machines.delete({ where: { id: existingVM.id } });
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/vms')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'invalid-vm',
          // Missing vmid, cluster_id, node, etc.
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should enforce minimum resource requirements', async () => {
      const response = await request(app)
        .post('/api/vms')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          vmid: 400,
          name: 'tiny-vm',
          cluster_id: testCluster.id,
          node: 'pve1',
          cores: 0,
          memory: 128,
          disk: 5,
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('minimum');
    });
  });

  describe('PUT /api/vms/:id', () => {
    let vmToUpdate: any;

    beforeEach(async () => {
      vmToUpdate = await prisma.virtual_machines.create({
        data: {
          vmid: 500,
          name: 'vm-to-update',
          company_id: testCompany.id,
          cluster_id: testCluster.id,
          node: 'pve1',
          cores: 2,
          memory: 2048,
          disk: 20,
        },
      });
    });

    afterEach(async () => {
      await prisma.virtual_machines.deleteMany({ where: { vmid: 500 } });
    });

    it('should update VM with valid data', async () => {
      const response = await request(app)
        .put(`/api/vms/${vmToUpdate.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          cores: 4,
          memory: 8192,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: vmToUpdate.id,
        cores: 4,
        memory: 8192,
      });
    });

    it('should prevent users from updating other company VMs', async () => {
      const otherCompany = await prisma.companies.create({
        data: { name: 'Other Company 2', status: 'active' },
      });

      const otherVM = await prisma.virtual_machines.create({
        data: {
          vmid: 501,
          name: 'other-vm',
          company_id: otherCompany.id,
          cluster_id: testCluster.id,
          node: 'pve1',
          cores: 2,
          memory: 2048,
          disk: 20,
        },
      });

      const response = await request(app)
        .put(`/api/vms/${otherVM.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ cores: 8 });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('permission');

      await prisma.virtual_machines.delete({ where: { id: otherVM.id } });
      await prisma.companies.delete({ where: { id: otherCompany.id } });
    });

    it('should allow super_admin to update any VM', async () => {
      const response = await request(app)
        .put(`/api/vms/${vmToUpdate.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ cores: 8 });

      expect(response.status).toBe(200);
      expect(response.body.data.cores).toBe(8);
    });
  });

  describe('POST /api/vms/:id/control', () => {
    let vmToControl: any;

    beforeAll(async () => {
      vmToControl = await prisma.virtual_machines.create({
        data: {
          vmid: 600,
          name: 'vm-to-control',
          company_id: testCompany.id,
          cluster_id: testCluster.id,
          node: 'pve1',
          cores: 2,
          memory: 2048,
          disk: 20,
          status: 'stopped',
        },
      });
    });

    afterAll(async () => {
      await prisma.virtual_machines.delete({ where: { id: vmToControl.id } });
    });

    it('should start VM', async () => {
      const response = await request(app)
        .post(`/api/vms/${vmToControl.id}/control`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ action: 'start' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('start');
    });

    it('should stop VM', async () => {
      await prisma.virtual_machines.update({
        where: { id: vmToControl.id },
        data: { status: 'running' },
      });

      const response = await request(app)
        .post(`/api/vms/${vmToControl.id}/control`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ action: 'stop' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject invalid actions', async () => {
      const response = await request(app)
        .post(`/api/vms/${vmToControl.id}/control`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ action: 'invalid-action' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid');
    });
  });

  describe('DELETE /api/vms/:id', () => {
    it('should delete VM', async () => {
      const vmToDelete = await prisma.virtual_machines.create({
        data: {
          vmid: 700,
          name: 'vm-to-delete',
          company_id: testCompany.id,
          cluster_id: testCluster.id,
          node: 'pve1',
          cores: 2,
          memory: 2048,
          disk: 20,
        },
      });

      const response = await request(app)
        .delete(`/api/vms/${vmToDelete.id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify VM is deleted
      const vm = await prisma.virtual_machines.findUnique({
        where: { id: vmToDelete.id },
      });
      expect(vm).toBeNull();
    });

    it('should prevent deletion of running VMs', async () => {
      const runningVM = await prisma.virtual_machines.create({
        data: {
          vmid: 701,
          name: 'running-vm',
          company_id: testCompany.id,
          cluster_id: testCluster.id,
          node: 'pve1',
          cores: 2,
          memory: 2048,
          disk: 20,
          status: 'running',
        },
      });

      const response = await request(app)
        .delete(`/api/vms/${runningVM.id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('running');

      await prisma.virtual_machines.delete({ where: { id: runningVM.id } });
    });
  });
});
