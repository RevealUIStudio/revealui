/**
 * Unit tests for mock utilities
 *
 * Tests that mocks work correctly and can be used with real code patterns
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { mockFetch, mockStripe, mockSupabase, resetAllMocks } from '../../utils/mocks.js';

describe('Mock Utilities (Testing Infrastructure)', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  describe('mockStripe', () => {
    it('should create customer mock', async () => {
      const customer = await mockStripe.customers.create({
        email: 'test@example.com',
      });

      expect(customer).toHaveProperty('id');
      expect(customer).toHaveProperty('email');
      expect(customer.email).toBe('test@example.com');
      expect(mockStripe.customers.create).toHaveBeenCalled();
    });

    it('should retrieve customer mock', async () => {
      const customer = await mockStripe.customers.retrieve('cus_test123');

      expect(customer).toHaveProperty('id');
      expect(customer).toHaveProperty('email');
      expect(mockStripe.customers.retrieve).toHaveBeenCalledWith('cus_test123');
    });

    it('should create checkout session mock', async () => {
      const session = await mockStripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [],
      });

      expect(session).toHaveProperty('id');
      expect(session).toHaveProperty('url');
      expect(session.id).toContain('cs_');
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalled();
    });

    it('should construct webhook event mock', () => {
      const event = mockStripe.webhooks.constructEvent('payload', 'signature', 'secret');

      expect(event).toHaveProperty('type');
      expect(event).toHaveProperty('data');
      expect(event.type).toBe('checkout.session.completed');
      expect(event.data.object).toHaveProperty('id');
    });
  });

  describe('mockSupabase', () => {
    it('should mock from() query builder', () => {
      const query = mockSupabase.from('users');

      expect(query).toBeDefined();
      expect(mockSupabase.from).toHaveBeenCalledWith('users');
    });

    it('should mock select() chain', () => {
      const query = mockSupabase.from('users').select('*');

      expect(query).toBeDefined();
      expect(mockSupabase.from).toHaveBeenCalled();
    });

    it('should mock getUser()', async () => {
      const result = await mockSupabase.auth.getUser();

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('error');
      expect(result.data.user).toHaveProperty('id');
      expect(result.data.user).toHaveProperty('email');
      expect(result.error).toBeNull();
    });

    it('should mock signInWithPassword()', async () => {
      const result = await mockSupabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'password',
      });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('error');
      expect(result.data.user).toHaveProperty('id');
      expect(result.data.session).toHaveProperty('access_token');
      expect(result.error).toBeNull();
    });

    it('should mock signOut()', async () => {
      const result = await mockSupabase.auth.signOut();

      expect(result).toBeDefined();
      expect(result).toHaveProperty('error');
      expect(result.error).toBeNull();
    });
  });

  describe('mockFetch', () => {
    it('should create fetch mock with default status', () => {
      const mockFn = mockFetch({ data: 'test' });

      expect(mockFn).toBeDefined();
      expect(typeof mockFn).toBe('function');
    });

    it('should create fetch mock with custom status', () => {
      const mockFn = mockFetch({ error: 'Not found' }, 404);

      expect(mockFn).toBeDefined();
    });

    it('should return response with ok property', async () => {
      const mockFn = mockFetch({ data: 'test' }, 200);
      const response = await mockFn('https://example.com');

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
    });

    it('should return response with error status', async () => {
      const mockFn = mockFetch({ error: 'Error' }, 500);
      const response = await mockFn('https://example.com');

      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
    });

    it('should return json() method', async () => {
      const data = { test: 'data' };
      const mockFn = mockFetch(data);
      const response = await mockFn('https://example.com');
      const json = await response.json();

      expect(json).toEqual(data);
    });

    it('should return text() method', async () => {
      const data = { test: 'data' };
      const mockFn = mockFetch(data);
      const response = await mockFn('https://example.com');
      const text = await response.text();

      expect(text).toBe(JSON.stringify(data));
    });
  });

  describe('resetAllMocks', () => {
    it('should reset all mocks', () => {
      // Call some mocks
      mockStripe.customers.create({ email: 'test@example.com' });
      mockSupabase.from('users');

      // Verify they were called
      expect(mockStripe.customers.create).toHaveBeenCalled();
      expect(mockSupabase.from).toHaveBeenCalled();

      // Reset
      resetAllMocks();

      // Verify mocks can still be called after reset
      expect(mockSupabase.from('users')).toBeDefined();
    });
  });
});
