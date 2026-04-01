/**
 * Authentication E2E Tests
 *
 * End-to-end tests for the authentication system using Playwright.
 * Tests the complete user flows: sign up, sign in, session management, sign out.
 */

import { expect, test } from '@playwright/test';

const BASE_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000';
const API_BASE = `${BASE_URL}/api/auth`;

test.describe('Authentication E2E Tests', () => {
  let testEmail: string;
  let testPassword: string;
  let testName: string;

  test.beforeEach(() => {
    // Generate unique test credentials for each test
    const timestamp = Date.now();
    testEmail = `e2e-test-${timestamp}@example.com`;
    testPassword = 'TestPassword123!';
    testName = `E2E Test User ${timestamp}`;
  });

  test.describe('Sign Up Flow', () => {
    test('should successfully sign up a new user', async ({ request }) => {
      const response = await request.post(`${API_BASE}/sign-up`, {
        data: {
          email: testEmail,
          password: testPassword,
          name: testName,
        },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      // API returns { user: {...} } without success field
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(testEmail);
      expect(data.user.name).toBe(testName);
      // Session token is set via cookie, not in response body
    });

    test('should fail to sign up with duplicate email', async ({ request }) => {
      // First sign up
      await request.post(`${API_BASE}/sign-up`, {
        data: {
          email: testEmail,
          password: testPassword,
          name: testName,
        },
      });

      // Try to sign up again with same email
      const response = await request.post(`${API_BASE}/sign-up`, {
        data: {
          email: testEmail,
          password: testPassword,
          name: 'Another Name',
        },
      });

      expect(response.status()).toBe(400);

      const data = await response.json();
      expect(data.error).toBeDefined();
      expect(data.error).toContain('already exists');
    });

    test('should fail to sign up with invalid email', async ({ request }) => {
      const response = await request.post(`${API_BASE}/sign-up`, {
        data: {
          email: 'invalid-email',
          password: testPassword,
          name: testName,
        },
      });

      expect(response.status()).toBe(400);

      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    test('should fail to sign up with weak password', async ({ request }) => {
      const response = await request.post(`${API_BASE}/sign-up`, {
        data: {
          email: testEmail,
          password: 'weak',
          name: testName,
        },
      });

      expect(response.status()).toBe(400);

      const data = await response.json();
      expect(data.error).toBeDefined();
    });
  });

  test.describe('Sign In Flow', () => {
    test.beforeEach(async ({ request }) => {
      // Create a user before each sign-in test
      await request.post(`${API_BASE}/sign-up`, {
        data: {
          email: testEmail,
          password: testPassword,
          name: testName,
        },
      });
    });

    test('should successfully sign in with correct credentials', async ({ request }) => {
      const response = await request.post(`${API_BASE}/sign-in`, {
        data: {
          email: testEmail,
          password: testPassword,
        },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(testEmail);
      // Session token is set via cookie, not in response body
      // Verify cookie is set
      const cookies = response.headers()['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies?.includes('revealui-session')).toBe(true);
    });

    test('should fail to sign in with incorrect password', async ({ request }) => {
      const response = await request.post(`${API_BASE}/sign-in`, {
        data: {
          email: testEmail,
          password: 'WrongPassword123!',
        },
      });

      expect(response.status()).toBe(401);

      const data = await response.json();
      expect(data.error).toBeDefined();
      expect(data.error).toContain('Invalid');
    });

    test('should fail to sign in with non-existent email', async ({ request }) => {
      const response = await request.post(`${API_BASE}/sign-in`, {
        data: {
          email: 'nonexistent@example.com',
          password: testPassword,
        },
      });

      expect(response.status()).toBe(401);

      const data = await response.json();
      expect(data.error).toBeDefined();
      expect(data.error).toContain('Invalid');
    });
  });

  test.describe('Session Management', () => {
    let sessionToken: string;

    test.beforeEach(async ({ request }) => {
      // Sign up and extract session token from cookie
      const signUpResponse = await request.post(`${API_BASE}/sign-up`, {
        data: {
          email: testEmail,
          password: testPassword,
          name: testName,
        },
      });

      // Extract session token from Set-Cookie header
      const setCookieHeader = signUpResponse.headers()['set-cookie'];
      if (setCookieHeader) {
        const cookieMatch = setCookieHeader.match(/revealui-session=([^;]+)/);
        if (cookieMatch) {
          sessionToken = cookieMatch[1];
        }
      }

      expect(sessionToken).toBeDefined();
    });

    test('should get current session with valid token', async ({ request }) => {
      const response = await request.get(`${API_BASE}/session`, {
        headers: {
          Cookie: `revealui-session=${sessionToken}`,
        },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.session).toBeDefined();
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(testEmail);
    });

    test('should return 401 for invalid session token', async ({ request }) => {
      const response = await request.get(`${API_BASE}/session`, {
        headers: {
          Cookie: 'revealui-session=invalid-token',
        },
      });

      expect(response.status()).toBe(401);

      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    test('should return 401 when session cookie is missing', async ({ request }) => {
      const response = await request.get(`${API_BASE}/session`);

      expect(response.status()).toBe(401);

      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    test('should successfully sign out', async ({ request }) => {
      const response = await request.post(`${API_BASE}/sign-out`, {
        headers: {
          Cookie: `revealui-session=${sessionToken}`,
        },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);

      // Verify session is deleted
      const sessionResponse = await request.get(`${API_BASE}/session`, {
        headers: {
          Cookie: `revealui-session=${sessionToken}`,
        },
      });

      expect(sessionResponse.status()).toBe(401);
    });
  });

  test.describe('Protected Routes', () => {
    let sessionToken: string;

    test.beforeEach(async ({ request }) => {
      // Sign up and extract session token from cookie
      const signUpResponse = await request.post(`${API_BASE}/sign-up`, {
        data: {
          email: testEmail,
          password: testPassword,
          name: testName,
        },
      });

      expect(signUpResponse.status()).toBe(200);

      // Extract session token from Set-Cookie header
      const setCookieHeader = signUpResponse.headers()['set-cookie'];
      if (setCookieHeader) {
        // Handle both string and array formats
        const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
        for (const cookie of cookies) {
          const cookieMatch = cookie.match(/revealui-session=([^;]+)/);
          if (cookieMatch) {
            sessionToken = cookieMatch[1];
            break;
          }
        }
      }

      expect(sessionToken).toBeDefined();
    });

    test('should access protected shape proxy route with valid session', async ({ request }) => {
      if (!sessionToken) {
        test.skip();
        return;
      }
      // Test agent-contexts shape proxy route
      const response = await request.get(`${BASE_URL}/api/shapes/agent-contexts`, {
        headers: {
          Cookie: `revealui-session=${sessionToken}`,
        },
      });

      // Should not return 401 (unauthorized)
      // May return 200 or other status depending on ElectricSQL connection
      expect(response.status()).not.toBe(401);
    });

    test('should reject protected shape proxy route without session', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/shapes/agent-contexts`);

      expect(response.status()).toBe(401);

      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    test('should reject protected shape proxy route with invalid session', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/shapes/agent-contexts`, {
        headers: {
          Cookie: 'revealui-session=invalid-token',
        },
      });

      expect(response.status()).toBe(401);

      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });
  });

  test.describe('Rate Limiting', () => {
    test('should rate limit after multiple failed sign-in attempts', async ({ request }) => {
      // Create user first
      await request.post(`${API_BASE}/sign-up`, {
        data: {
          email: testEmail,
          password: testPassword,
          name: testName,
        },
      });

      // Make multiple failed sign-in attempts
      const attempts = 6; // Should trigger rate limit after 5
      let rateLimited = false;

      for (let i = 0; i < attempts; i++) {
        const response = await request.post(`${API_BASE}/sign-in`, {
          data: {
            email: testEmail,
            password: 'WrongPassword',
          },
        });

        if (response.status() === 429) {
          rateLimited = true;
          break;
        }
      }

      // Rate limiting must trigger within the allowed attempt window.
      // If it never triggered after all attempts, the feature is broken.
      expect(rateLimited).toBe(true);
    });
  });
});
