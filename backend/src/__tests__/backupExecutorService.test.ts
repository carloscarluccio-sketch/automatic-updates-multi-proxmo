/**
 * Unit tests for Backup Executor Service
 * Tests backup scheduling, execution, and retention logic
 */

import { PrismaClient } from '@prisma/client';
import { executeScheduledBackups } from '../services/backupExecutorService';

// Mock Prisma
jest.mock('@prisma/client');
const mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;

// Mock axios for Proxmox API calls
jest.mock('axios');
import axios from 'axios';
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock nodemailer
jest.mock('nodemailer');
import * as nodemailer from 'nodemailer';

describe('Backup Executor Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('executeScheduledBackups', () => {
    it('should find and execute due backups', async () => {
      // Mock database response
      const mockSchedules = [
        {
          id: 1,
          name: 'Test Backup',
          company_id: 1,
          cluster_id: 1,
          vm_id: 100,
          schedule_type: 'daily',
          schedule_time: '02:00',
          retention_days: 7,
          retention_count: null,
          compression: 'zstd',
          mode: 'snapshot',
          storage_location: 'local',
          notification_email: 'test@example.com',
          notify_on_success: true,
          notify_on_failure: true,
          enabled: true,
          next_run: new Date('2025-12-19T02:00:00'),
          virtual_machines: {
            id: 100,
            vmid: 100,
            name: 'test-vm',
            node: 'pve1',
          },
          proxmox_clusters: {
            id: 1,
            name: 'test-cluster',
            host: '192.168.1.100',
            port: 8006,
            username: 'root@pam',
            password_encrypted: 'encrypted_pass',
          },
          companies: {
            id: 1,
            name: 'Test Company',
          },
        },
      ];

      (mockPrisma.backup_schedules.findMany as jest.Mock).mockResolvedValue(mockSchedules);
      (mockPrisma.backup_history.create as jest.Mock).mockResolvedValue({ id: 1 });
      (mockPrisma.backup_history.update as jest.Mock).mockResolvedValue({ id: 1 });
      (mockPrisma.backup_schedules.update as jest.Mock).mockResolvedValue({ id: 1 });

      // Mock Proxmox authentication
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          data: {
            ticket: 'test-ticket',
            CSRFPreventionToken: 'test-csrf',
          },
        },
      });

      // Mock vzdump task start
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          data: 'UPID:test-task-id',
        },
      });

      // Mock task status polling
      mockedAxios.get.mockResolvedValue({
        data: {
          data: {
            status: 'stopped',
            exitstatus: 'OK',
          },
        },
      });

      // Mock email transport
      const mockSendMail = jest.fn().mockResolvedValue({});
      (nodemailer.createTransport as jest.Mock).mockReturnValue({
        sendMail: mockSendMail,
      });

      await executeScheduledBackups();

      // Verify backup was executed
      expect(mockPrisma.backup_schedules.findMany).toHaveBeenCalledWith({
        where: {
          enabled: true,
          next_run: {
            lte: expect.any(Date),
          },
        },
        include: expect.any(Object),
      });

      expect(mockPrisma.backup_history.create).toHaveBeenCalled();
      expect(mockPrisma.backup_history.update).toHaveBeenCalled();
      expect(mockSendMail).toHaveBeenCalled();
    });

    it('should handle backup failures gracefully', async () => {
      const mockSchedules = [
        {
          id: 1,
          name: 'Failing Backup',
          company_id: 1,
          cluster_id: 1,
          vm_id: 100,
          schedule_type: 'daily',
          enabled: true,
          next_run: new Date(),
          virtual_machines: {
            id: 100,
            vmid: 100,
            name: 'test-vm',
            node: 'pve1',
          },
          proxmox_clusters: {
            id: 1,
            host: '192.168.1.100',
            port: 8006,
            username: 'root@pam',
            password_encrypted: 'encrypted_pass',
          },
          companies: {
            id: 1,
            name: 'Test Company',
          },
          notification_email: 'test@example.com',
          notify_on_failure: true,
        },
      ];

      (mockPrisma.backup_schedules.findMany as jest.Mock).mockResolvedValue(mockSchedules);
      (mockPrisma.backup_history.create as jest.Mock).mockResolvedValue({ id: 1 });
      (mockPrisma.backup_history.update as jest.Mock).mockResolvedValue({ id: 1 });
      (mockPrisma.backup_schedules.update as jest.Mock).mockResolvedValue({ id: 1 });

      // Mock Proxmox auth failure
      mockedAxios.post.mockRejectedValue(new Error('Connection refused'));

      await executeScheduledBackups();

      // Verify failure was recorded
      expect(mockPrisma.backup_history.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          status: 'failed',
          error_message: expect.any(String),
        }),
      });

      expect(mockPrisma.backup_schedules.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          last_status: 'failed',
          last_error: expect.any(String),
        }),
      });
    });

    it('should calculate next run correctly for daily schedules', async () => {
      const mockSchedules = [
        {
          id: 1,
          schedule_type: 'daily',
          schedule_time: '02:00',
          enabled: true,
          next_run: new Date(),
          virtual_machines: { id: 100, vmid: 100, name: 'test', node: 'pve1' },
          proxmox_clusters: { id: 1, host: '192.168.1.100', port: 8006, username: 'root@pam', password_encrypted: 'pass' },
          companies: { id: 1, name: 'Test' },
        },
      ];

      (mockPrisma.backup_schedules.findMany as jest.Mock).mockResolvedValue(mockSchedules);
      (mockPrisma.backup_history.create as jest.Mock).mockResolvedValue({ id: 1 });
      (mockPrisma.backup_history.update as jest.Mock).mockResolvedValue({ id: 1 });
      (mockPrisma.backup_schedules.update as jest.Mock).mockResolvedValue({ id: 1 });

      mockedAxios.post.mockResolvedValue({
        data: { data: { ticket: 'test', CSRFPreventionToken: 'test' } },
      });
      mockedAxios.post.mockResolvedValueOnce({
        data: { data: 'UPID:test' },
      });
      mockedAxios.get.mockResolvedValue({
        data: { data: { status: 'stopped', exitstatus: 'OK' } },
      });

      await executeScheduledBackups();

      // Verify next_run was updated to tomorrow at 02:00
      expect(mockPrisma.backup_schedules.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          next_run: expect.any(Date),
          last_status: 'success',
        }),
      });

      const updateCall = (mockPrisma.backup_schedules.update as jest.Mock).mock.calls[0][0];
      const nextRun = updateCall.data.next_run as Date;
      expect(nextRun.getHours()).toBe(2);
      expect(nextRun.getMinutes()).toBe(0);
    });

    it('should cleanup old backups based on retention_days', async () => {
      const mockSchedules = [
        {
          id: 1,
          retention_days: 7,
          retention_count: null,
          enabled: true,
          next_run: new Date(),
          virtual_machines: { id: 100, vmid: 100, name: 'test', node: 'pve1' },
          proxmox_clusters: { id: 1, host: '192.168.1.100', port: 8006, username: 'root@pam', password_encrypted: 'pass' },
          companies: { id: 1, name: 'Test' },
        },
      ];

      (mockPrisma.backup_schedules.findMany as jest.Mock).mockResolvedValue(mockSchedules);
      (mockPrisma.backup_history.create as jest.Mock).mockResolvedValue({ id: 1 });
      (mockPrisma.backup_history.update as jest.Mock).mockResolvedValue({ id: 1 });
      (mockPrisma.backup_history.deleteMany as jest.Mock).mockResolvedValue({ count: 3 });
      (mockPrisma.backup_schedules.update as jest.Mock).mockResolvedValue({ id: 1 });

      mockedAxios.post.mockResolvedValue({
        data: { data: { ticket: 'test', CSRFPreventionToken: 'test' } },
      });
      mockedAxios.post.mockResolvedValueOnce({
        data: { data: 'UPID:test' },
      });
      mockedAxios.get.mockResolvedValue({
        data: { data: { status: 'stopped', exitstatus: 'OK' } },
      });

      await executeScheduledBackups();

      // Verify cleanup was called
      expect(mockPrisma.backup_history.deleteMany).toHaveBeenCalledWith({
        where: {
          schedule_id: 1,
          started_at: {
            lt: expect.any(Date),
          },
          status: {
            in: ['completed', 'expired'],
          },
        },
      });
    });

    it('should cleanup old backups based on retention_count', async () => {
      const mockSchedules = [
        {
          id: 1,
          retention_days: null,
          retention_count: 5,
          enabled: true,
          next_run: new Date(),
          virtual_machines: { id: 100, vmid: 100, name: 'test', node: 'pve1' },
          proxmox_clusters: { id: 1, host: '192.168.1.100', port: 8006, username: 'root@pam', password_encrypted: 'pass' },
          companies: { id: 1, name: 'Test' },
        },
      ];

      const oldBackups = [
        { id: 6 },
        { id: 7 },
        { id: 8 },
      ];

      (mockPrisma.backup_schedules.findMany as jest.Mock).mockResolvedValue(mockSchedules);
      (mockPrisma.backup_history.create as jest.Mock).mockResolvedValue({ id: 1 });
      (mockPrisma.backup_history.update as jest.Mock).mockResolvedValue({ id: 1 });
      (mockPrisma.backup_history.findMany as jest.Mock).mockResolvedValue(oldBackups);
      (mockPrisma.backup_history.deleteMany as jest.Mock).mockResolvedValue({ count: 3 });
      (mockPrisma.backup_schedules.update as jest.Mock).mockResolvedValue({ id: 1 });

      mockedAxios.post.mockResolvedValue({
        data: { data: { ticket: 'test', CSRFPreventionToken: 'test' } },
      });
      mockedAxios.post.mockResolvedValueOnce({
        data: { data: 'UPID:test' },
      });
      mockedAxios.get.mockResolvedValue({
        data: { data: { status: 'stopped', exitstatus: 'OK' } },
      });

      await executeScheduledBackups();

      // Verify cleanup found old backups
      expect(mockPrisma.backup_history.findMany).toHaveBeenCalledWith({
        where: { schedule_id: 1 },
        orderBy: { started_at: 'desc' },
        skip: 5,
      });

      // Verify deletion of old backups
      expect(mockPrisma.backup_history.deleteMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: [6, 7, 8],
          },
        },
      });
    });
  });
});
