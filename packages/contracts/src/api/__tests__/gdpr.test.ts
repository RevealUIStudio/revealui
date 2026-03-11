/**
 * GDPR Contract Tests
 *
 * Tests for GDPR/privacy API contracts
 */

import { describe, expect, it } from 'vitest';
import { GDPRDeleteRequestContract, GDPRExportRequestContract } from '../gdpr.js';

describe('GDPRExportRequestContract', () => {
  describe('valid data', () => {
    it('validates with userId', () => {
      const result = GDPRExportRequestContract.validate({
        userId: 'user-123',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.userId).toBe('user-123');
      }
    });

    it('validates with email', () => {
      const result = GDPRExportRequestContract.validate({
        email: 'user@example.com',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('user@example.com');
      }
    });

    it('validates with both userId and email', () => {
      const result = GDPRExportRequestContract.validate({
        userId: 'user-123',
        email: 'user@example.com',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.userId).toBe('user-123');
        expect(result.data.email).toBe('user@example.com');
      }
    });
  });

  describe('invalid data', () => {
    it('rejects when neither userId nor email provided', () => {
      const result = GDPRExportRequestContract.validate({});

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.issues[0]?.message).toContain('userId or email');
      }
    });

    it('rejects invalid email format', () => {
      const result = GDPRExportRequestContract.validate({
        email: 'not-an-email',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.issues[0]?.message).toContain('Invalid email format');
      }
    });

    it('rejects when only invalid email provided', () => {
      const result = GDPRExportRequestContract.validate({
        email: 'invalid',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('rejects empty string userId', () => {
      const result = GDPRExportRequestContract.validate({
        userId: '',
      });

      // Empty string is falsy in the refinement logic
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.issues[0]?.message).toContain('userId or email');
      }
    });

    it('validates email format when provided with userId', () => {
      const result = GDPRExportRequestContract.validate({
        userId: 'user-123',
        email: 'not-an-email',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.issues[0]?.message).toContain('Invalid email format');
      }
    });
  });
});

describe('GDPRDeleteRequestContract', () => {
  describe('valid data', () => {
    it('validates with userId and confirmation', () => {
      const result = GDPRDeleteRequestContract.validate({
        userId: 'user-123',
        confirmation: 'DELETE',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.userId).toBe('user-123');
        expect(result.data.confirmation).toBe('DELETE');
      }
    });

    it('validates with email and confirmation', () => {
      const result = GDPRDeleteRequestContract.validate({
        email: 'user@example.com',
        confirmation: 'DELETE',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('user@example.com');
        expect(result.data.confirmation).toBe('DELETE');
      }
    });

    it('validates with both userId, email, and confirmation', () => {
      const result = GDPRDeleteRequestContract.validate({
        userId: 'user-123',
        email: 'user@example.com',
        confirmation: 'DELETE',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.userId).toBe('user-123');
        expect(result.data.email).toBe('user@example.com');
        expect(result.data.confirmation).toBe('DELETE');
      }
    });
  });

  describe('invalid data', () => {
    it('rejects when neither userId nor email provided', () => {
      const result = GDPRDeleteRequestContract.validate({
        confirmation: 'DELETE',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.issues[0]?.message).toContain('userId or email');
      }
    });

    it('rejects missing confirmation', () => {
      const result = GDPRDeleteRequestContract.validate({
        userId: 'user-123',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.issues[0]?.path).toContain('confirmation');
      }
    });

    it('rejects wrong confirmation value', () => {
      const result = GDPRDeleteRequestContract.validate({
        userId: 'user-123',
        confirmation: 'delete',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.issues[0]?.message).toContain('DELETE');
      }
    });

    it('rejects confirmation with extra text', () => {
      const result = GDPRDeleteRequestContract.validate({
        userId: 'user-123',
        confirmation: 'DELETE PLEASE',
      });

      expect(result.success).toBe(false);
    });

    it('rejects invalid email format', () => {
      const result = GDPRDeleteRequestContract.validate({
        email: 'not-an-email',
        confirmation: 'DELETE',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.issues[0]?.message).toContain('Invalid email format');
      }
    });
  });

  describe('security', () => {
    it('enforces exact "DELETE" literal (case-sensitive)', () => {
      const lowercaseResult = GDPRDeleteRequestContract.validate({
        userId: 'user-123',
        confirmation: 'delete',
      });
      expect(lowercaseResult.success).toBe(false);

      const uppercaseResult = GDPRDeleteRequestContract.validate({
        userId: 'user-123',
        confirmation: 'DELETE',
      });
      expect(uppercaseResult.success).toBe(true);
    });

    it('rejects confirmation with whitespace', () => {
      const result = GDPRDeleteRequestContract.validate({
        userId: 'user-123',
        confirmation: ' DELETE ',
      });

      expect(result.success).toBe(false);
    });

    it('requires both identifier and confirmation', () => {
      const noConfirmation = GDPRDeleteRequestContract.validate({
        userId: 'user-123',
      });
      expect(noConfirmation.success).toBe(false);

      const noIdentifier = GDPRDeleteRequestContract.validate({
        confirmation: 'DELETE',
      });
      expect(noIdentifier.success).toBe(false);
    });
  });
});
