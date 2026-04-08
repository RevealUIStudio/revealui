/**
 * Unit tests for fixture validation
 *
 * Tests that fixtures create valid data structures and work with validation schemas
 */

import { emailSchema, passwordSchema } from '@admin/lib/validation/schemas';
import { describe, expect, it } from 'vitest';
import {
  createSuccessfulPayment,
  createTestPayment,
  defaultTestPayments,
} from '../../fixtures/payments.js';
import {
  createAdminUser,
  createTestUser,
  createTestUsers,
  defaultTestUsers,
} from '../../fixtures/users.js';

describe('Fixture Validation (Testing Infrastructure)', () => {
  describe('User Fixtures', () => {
    it('should create valid test user with email that passes validation', () => {
      const user = createTestUser();

      // Validate email using real schema
      const emailResult = emailSchema.safeParse(user.email);
      expect(emailResult.success).toBe(true);

      // Validate password using real schema
      const passwordResult = passwordSchema.safeParse(user.password);
      expect(passwordResult.success).toBe(true);

      // Check structure
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('password');
      expect(user).toHaveProperty('role');
    });

    it('should create admin user with valid data', () => {
      const admin = createAdminUser();

      expect(admin.role).toBe('admin');

      const emailResult = emailSchema.safeParse(admin.email);
      expect(emailResult.success).toBe(true);

      const passwordResult = passwordSchema.safeParse(admin.password);
      expect(passwordResult.success).toBe(true);
    });

    it('should create multiple users with unique emails', () => {
      const users = createTestUsers(5);

      expect(users).toHaveLength(5);

      // All emails should be unique
      const emails = users.map((u) => u.email);
      const uniqueEmails = new Set(emails);
      expect(uniqueEmails.size).toBe(5);

      // All emails should pass validation
      users.forEach((user) => {
        const result = emailSchema.safeParse(user.email);
        expect(result.success).toBe(true);
      });
    });

    it('should allow overriding user properties', () => {
      const user = createTestUser({
        email: 'custom@example.com',
        role: 'admin',
      });

      expect(user.email).toBe('custom@example.com');
      expect(user.role).toBe('admin');

      // Custom email should still pass validation
      const emailResult = emailSchema.safeParse(user.email);
      expect(emailResult.success).toBe(true);
    });

    it('should have default test users with valid data', () => {
      // Test admin user
      const adminEmailResult = emailSchema.safeParse(defaultTestUsers.admin.email);
      expect(adminEmailResult.success).toBe(true);

      const adminPasswordResult = passwordSchema.safeParse(defaultTestUsers.admin.password);
      expect(adminPasswordResult.success).toBe(true);

      // Test regular user
      const regularEmailResult = emailSchema.safeParse(defaultTestUsers.regular.email);
      expect(regularEmailResult.success).toBe(true);

      // Test guest user
      const guestEmailResult = emailSchema.safeParse(defaultTestUsers.guest.email);
      expect(guestEmailResult.success).toBe(true);
    });
  });

  describe('Payment Fixtures', () => {
    it('should create valid test payment', () => {
      const payment = createTestPayment();

      expect(payment).toHaveProperty('id');
      expect(payment).toHaveProperty('amount');
      expect(payment).toHaveProperty('currency');
      expect(payment).toHaveProperty('customerId');
      expect(payment).toHaveProperty('status');

      expect(typeof payment.amount).toBe('number');
      expect(payment.amount).toBeGreaterThan(0);
      expect(payment.currency).toBe('usd');
    });

    it('should create successful payment', () => {
      const payment = createSuccessfulPayment();

      expect(payment.status).toBe('succeeded');
      expect(payment.amount).toBeGreaterThan(0);
    });

    it('should allow overriding payment properties', () => {
      const payment = createTestPayment({
        amount: 5000,
        currency: 'eur',
        status: 'succeeded',
      });

      expect(payment.amount).toBe(5000);
      expect(payment.currency).toBe('eur');
      expect(payment.status).toBe('succeeded');
    });

    it('should have default test payments with valid structure', () => {
      expect(defaultTestPayments.small).toHaveProperty('amount');
      expect(defaultTestPayments.small.status).toBe('succeeded');

      expect(defaultTestPayments.medium).toHaveProperty('amount');
      expect(defaultTestPayments.medium.amount).toBeGreaterThan(defaultTestPayments.small.amount);

      expect(defaultTestPayments.pending.status).toBe('pending');
      expect(defaultTestPayments.failed.status).toBe('failed');
    });
  });

  describe('Fixture Integration', () => {
    it('should create user and payment that work together', () => {
      const user = createTestUser();
      const payment = createTestPayment({ customerId: user.id });

      expect(payment.customerId).toBe(user.id);
      expect(user).toHaveProperty('id');
      expect(payment).toHaveProperty('customerId');
    });

    it('should create fixtures that match expected API structures', () => {
      const user = createTestUser();

      // User should have all expected fields
      expect(user).toMatchObject({
        id: expect.any(String),
        email: expect.any(String),
        password: expect.any(String),
      });

      const payment = createTestPayment();

      // Payment should have all expected fields
      expect(payment).toMatchObject({
        id: expect.any(String),
        amount: expect.any(Number),
        currency: expect.any(String),
        customerId: expect.any(String),
        status: expect.any(String),
      });
    });
  });
});
