/**
 * Waitlist API Test  -  Redirect Verification
 *
 * Waitlist is closed. The endpoint now:
 * - GET: 301 redirects to signup
 * - POST: returns 410 Gone with a message
 */

import { describe, expect, it } from 'vitest';
import { GET, POST } from '../route';

describe('Waitlist endpoint (closed)', () => {
  describe('GET /api/waitlist', () => {
    it('returns a 301 redirect to signup', () => {
      const response = GET();

      expect(response.status).toBe(301);
      expect(response.headers.get('location')).toBe('https://admin.revealui.com/signup');
    });
  });

  describe('POST /api/waitlist', () => {
    it('returns 410 Gone', async () => {
      const response = POST();
      const data = await response.json();

      expect(response.status).toBe(410);
      expect(data.message).toContain('Waitlist closed');
      expect(data.message).toContain('https://admin.revealui.com/signup');
    });
  });
});
