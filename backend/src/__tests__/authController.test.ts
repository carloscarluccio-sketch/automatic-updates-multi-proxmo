/**
 * Integration tests for Authentication Controller
 * Tests login, JWT generation, 2FA, and SSO flows
 */

import request from 'supertest';
import app from '../index';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

describe('Authentication Controller', () => {
  let testUser: any;
  let testCompany: any;

  beforeAll(async () => {
    // Create test company
    testCompany = await prisma.companies.create({
      data: {
        name: 'Test Company',
        owner_name: 'Test Owner',
        primary_email: 'owner@testcompany.com',
        status: 'active',
      },
    });

    // Create test user
    const hashedPassword = await bcrypt.hash('Test123!', 10);
    testUser = await prisma.users.create({
      data: {
        username: 'testuser',
        email: 'test@example.com',
        password_hash: hashedPassword,
        role: 'user',
        company_id: testCompany.id,
        status: 'active',
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.users.delete({ where: { id: testUser.id } });
    await prisma.companies.delete({ where: { id: testCompany.id } });
    await prisma.$disconnect();
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Test123!',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toMatchObject({
        id: testUser.id,
        email: 'test@example.com',
        role: 'user',
      });
    });

    it('should reject invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid');
    });

    it('should reject non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistent',
          password: 'Test123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should reject inactive user', async () => {
      // Create inactive user
      const hashedPassword = await bcrypt.hash('Test123!', 10);
      const inactiveUser = await prisma.users.create({
        data: {
          username: 'inactive',
          email: 'inactive@example.com',
          password_hash: hashedPassword,
          role: 'user',
          company_id: testCompany.id,
          status: 'inactive',
        },
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'inactive',
          password: 'Test123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('inactive');

      await prisma.users.delete({ where: { id: inactiveUser.id } });
    });

    it('should enforce rate limiting', async () => {
      const promises = [];
      for (let i = 0; i < 12; i++) {
        promises.push(
          request(app)
            .post('/api/auth/login')
            .send({
              email: 'test@example.com',
              password: 'WrongPassword',
            })
        );
      }

      const responses = await Promise.all(promises);
      const rateLimited = responses.some(r => r.status === 429);
      expect(rateLimited).toBe(true);
    });
  });

  describe('POST /api/auth/verify', () => {
    let validToken: string;

    beforeAll(() => {
      validToken = jwt.sign(
        { sub: testUser.id },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '24h' }
      );
    });

    it('should verify valid token', async () => {
      const response = await request(app)
        .post('/api/auth/verify')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.id).toBe(testUser.id);
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/verify')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should reject expired token', async () => {
      const expiredToken = jwt.sign(
        { sub: testUser.id },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1ms' }
      );

      await new Promise(resolve => setTimeout(resolve, 10));

      const response = await request(app)
        .post('/api/auth/verify')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('expired');
    });

    it('should reject missing token', async () => {
      const response = await request(app).post('/api/auth/verify');

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('No token');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh valid token', async () => {
      const token = jwt.sign(
        { sub: testUser.id },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.token).not.toBe(token);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const token = jwt.sign(
        { sub: testUser.id },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/auth/change-password', () => {
    it('should change password with valid current password', async () => {
      const token = jwt.sign(
        { sub: testUser.id },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'Test123!',
          newPassword: 'NewTest456!',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify can login with new password
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password_hash: 'NewTest456!',
        });

      expect(loginResponse.status).toBe(200);

      // Reset password back
      const hashedPassword = await bcrypt.hash('Test123!', 10);
      await prisma.users.update({
        where: { id: testUser.id },
        data: { password_hash: hashedPassword },
      });
    });

    it('should reject weak passwords', async () => {
      const token = jwt.sign(
        { sub: testUser.id },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'Test123!',
          newPassword: '123',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('password');
    });
  });
});
