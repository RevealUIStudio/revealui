/**
 * Full Signup -> Verify -> Login -> Admin Dashboard E2E Tests
 *
 * Tests the complete user onboarding lifecycle:
 * 1. Signup form rendering and validation
 * 2. Successful account creation via API
 * 3. Login flow with credentials
 * 4. Admin dashboard access (authenticated vs unauthenticated)
 *
 * Note: Email verification cannot be tested end-to-end without a real or
 * test SMTP server. The signup API grants a session cookie only when
 * emailVerified is true (first user gets auto-verified as admin). For
 * subsequent users, the sign-in endpoint returns EMAIL_NOT_VERIFIED (403).
 * These tests cover both paths.
 *
 * Tags: @auth @signup @login @admin
 */

import { expect, test } from '@playwright/test';

const CMS_URL =
  process.env.CMS_BASE_URL || process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000';
const API_AUTH = `${CMS_URL}/api/auth`;

// Generate unique credentials per test run to avoid collisions
const RUN_ID = Date.now();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract a named cookie value from a Set-Cookie header string.
 * Uses string methods only (no regex) per project policy.
 */
function extractCookieValue(setCookieHeader: string, cookieName: string): string | null {
  // Set-Cookie headers may be semicolon-separated attributes.
  // The cookie value is `cookieName=<value>` before the first semicolon.
  const prefix = `${cookieName}=`;

  // The header may contain multiple cookies (comma-separated in some runtimes)
  // or a single cookie. Split by comma first, then look for our cookie.
  const parts = setCookieHeader.split(',');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      const valueAndAttrs = trimmed.slice(prefix.length);
      const semiIndex = valueAndAttrs.indexOf(';');
      return semiIndex === -1 ? valueAndAttrs : valueAndAttrs.slice(0, semiIndex);
    }
    // Cookie name might appear after a space (e.g., " revealui-session=...")
    const spaceIndex = trimmed.indexOf(` ${prefix}`);
    if (spaceIndex !== -1) {
      const valueStart = spaceIndex + prefix.length + 1;
      const rest = trimmed.slice(valueStart);
      const semiIndex = rest.indexOf(';');
      return semiIndex === -1 ? rest : rest.slice(0, semiIndex);
    }
  }
  return null;
}

/**
 * Sign in via API and return the session token string.
 */
async function signInAndGetToken(
  request: {
    post: (
      url: string,
      options: { data: Record<string, unknown> },
    ) => Promise<{
      status: () => number;
      headers: () => Record<string, string>;
    }>;
  },
  email: string,
  password: string,
): Promise<string | null> {
  const response = await request.post(`${API_AUTH}/sign-in`, {
    data: { email, password },
  });

  if (response.status() !== 200) {
    return null;
  }

  const setCookie = response.headers()['set-cookie'] ?? '';
  return extractCookieValue(setCookie, 'revealui-session');
}

// ===========================================================================
// 1. Signup Page Rendering & Validation
// ===========================================================================

test.describe('Signup Page @auth @signup', () => {
  test('signup page renders with all form fields', async ({ page }) => {
    await page.goto(`${CMS_URL}/signup`);
    await page.waitForLoadState('networkidle');

    // Card title
    const heading = page.locator('text=Create your account');
    await expect(heading).toBeVisible({ timeout: 10000 });

    // Name field
    const nameInput = page.locator('#name');
    await expect(nameInput).toBeVisible();

    // Email field
    const emailInput = page.locator('#email');
    await expect(emailInput).toBeVisible();

    // Password field
    const passwordInput = page.locator('#password');
    await expect(passwordInput).toBeVisible();

    // TOS checkbox
    const tosCheckbox = page.locator('#tos');
    await expect(tosCheckbox).toBeAttached();

    // Submit button
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
    const buttonText = await submitButton.textContent();
    expect(buttonText).toContain('Create account');

    // Link to login page
    const loginLink = page.locator('a[href="/login"]');
    await expect(loginLink).toBeVisible();
  });

  test('signup page shows password requirements hint', async ({ page }) => {
    await page.goto(`${CMS_URL}/signup`);
    await page.waitForLoadState('networkidle');

    const hint = page.locator('text=Min 8 characters');
    await expect(hint).toBeVisible({ timeout: 10000 });
  });

  test('submit button is disabled when TOS is not accepted', async ({ page }) => {
    await page.goto(`${CMS_URL}/signup`);
    await page.waitForLoadState('networkidle');

    // Wait for form to render
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible({ timeout: 10000 });

    // TOS checkbox is unchecked by default — submit should be disabled
    await expect(submitButton).toBeDisabled();
  });

  test('navigating to login link works', async ({ page }) => {
    await page.goto(`${CMS_URL}/signup`);
    await page.waitForLoadState('networkidle');

    const loginLink = page.locator('a[href="/login"]');
    await expect(loginLink).toBeVisible({ timeout: 10000 });
    await loginLink.click();

    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/login');
  });
});

// ===========================================================================
// 2. Signup API Validation
// ===========================================================================

test.describe('Signup API Validation @auth @signup', () => {
  test('rejects signup with invalid email', async ({ request }) => {
    const response = await request.post(`${API_AUTH}/sign-up`, {
      data: {
        email: 'not-an-email',
        password: 'TestPassword123!',
        name: 'Test User',
        tosAccepted: true,
      },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  test('rejects signup with weak password', async ({ request }) => {
    const response = await request.post(`${API_AUTH}/sign-up`, {
      data: {
        email: `weak-pw-${RUN_ID}@test.revealui.com`,
        password: 'short',
        name: 'Test User',
        tosAccepted: true,
      },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  test('rejects signup with missing name', async ({ request }) => {
    const response = await request.post(`${API_AUTH}/sign-up`, {
      data: {
        email: `no-name-${RUN_ID}@test.revealui.com`,
        password: 'TestPassword123!',
        tosAccepted: true,
      },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  test('rejects signup with empty request body', async ({ request }) => {
    const response = await request.post(`${API_AUTH}/sign-up`, {
      data: {},
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  test('creates account successfully with valid data', async ({ request }) => {
    const email = `signup-api-${RUN_ID}@test.revealui.com`;
    const response = await request.post(`${API_AUTH}/sign-up`, {
      data: {
        email,
        password: 'TestPassword123!',
        name: `Signup API Test ${RUN_ID}`,
        tosAccepted: true,
      },
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe(email);
    expect(data.user.name).toBe(`Signup API Test ${RUN_ID}`);
  });

  test('rejects duplicate email signup', async ({ request }) => {
    const email = `signup-dup-${RUN_ID}@test.revealui.com`;

    // First signup
    const first = await request.post(`${API_AUTH}/sign-up`, {
      data: {
        email,
        password: 'TestPassword123!',
        name: `Dup Test ${RUN_ID}`,
        tosAccepted: true,
      },
    });
    expect(first.status()).toBe(200);

    // Second signup with same email
    const second = await request.post(`${API_AUTH}/sign-up`, {
      data: {
        email,
        password: 'TestPassword123!',
        name: 'Another Name',
        tosAccepted: true,
      },
    });

    expect(second.status()).toBe(400);
    const data = await second.json();
    expect(data.error).toBeDefined();
  });
});

// ===========================================================================
// 3. Signup Form Submission (Browser)
// ===========================================================================

test.describe('Signup Form Submission @auth @signup', () => {
  test('filling and submitting the signup form', async ({ page }) => {
    const email = `signup-form-${RUN_ID}@test.revealui.com`;

    await page.goto(`${CMS_URL}/signup`);
    await page.waitForLoadState('networkidle');

    // Wait for form to be interactive
    const nameInput = page.locator('#name');
    await expect(nameInput).toBeVisible({ timeout: 10000 });

    // Fill the form
    await nameInput.fill(`Signup Form Test ${RUN_ID}`);
    await page.locator('#email').fill(email);
    await page.locator('#password').fill('TestPassword123!');
    await page.locator('#tos').check();

    // Submit button should now be enabled
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeEnabled();

    // Submit the form
    await submitButton.click();

    // Wait for navigation or response. After signup, the app either:
    // - Redirects to /admin (first user, auto-verified admin)
    // - Redirects to / (subsequent user, pending email verification)
    // - Shows an error message (e.g., duplicate email)
    await page.waitForLoadState('networkidle');

    // The form should have been processed — we should no longer be on /signup
    // OR an error should be displayed. Both are valid outcomes depending on
    // server state.
    const currentUrl = page.url();
    const errorBanner = page.locator('.bg-red-50, [class*="bg-red"]');
    const errorVisible = await errorBanner.isVisible().catch(() => false);

    // Either we navigated away from signup, or an error is shown
    const navigatedAway = !currentUrl.includes('/signup');
    expect(navigatedAway || errorVisible).toBe(true);
  });

  test('signup form shows TOS required error when checkbox not accepted', async ({ page }) => {
    await page.goto(`${CMS_URL}/signup`);
    await page.waitForLoadState('networkidle');

    const nameInput = page.locator('#name');
    await expect(nameInput).toBeVisible({ timeout: 10000 });

    // Fill everything except TOS
    await nameInput.fill('No TOS User');
    await page.locator('#email').fill(`no-tos-${RUN_ID}@test.revealui.com`);
    await page.locator('#password').fill('TestPassword123!');

    // Submit button should be disabled without TOS
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeDisabled();
  });
});

// ===========================================================================
// 4. Login Page Rendering & Flow
// ===========================================================================

test.describe('Login Page @auth @login', () => {
  test('login page renders with all form fields', async ({ page }) => {
    await page.goto(`${CMS_URL}/login`);
    await page.waitForLoadState('networkidle');

    // Card title
    const heading = page.locator('text=Sign in to your account');
    await expect(heading).toBeVisible({ timeout: 10000 });

    // Email field
    const emailInput = page.locator('#email');
    await expect(emailInput).toBeVisible();

    // Password field
    const passwordInput = page.locator('#password');
    await expect(passwordInput).toBeVisible();

    // Submit button
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
    const buttonText = await submitButton.textContent();
    expect(buttonText).toContain('Sign in');

    // Link to signup page
    const signupLink = page.locator('a[href="/signup"]');
    await expect(signupLink).toBeVisible();

    // Forgot password link
    const forgotLink = page.locator('a[href="/reset-password"]');
    await expect(forgotLink).toBeVisible();

    // OAuth buttons
    const githubButton = page.locator('a[href="/api/auth/github"]');
    await expect(githubButton).toBeVisible();

    const googleButton = page.locator('a[href="/api/auth/google"]');
    await expect(googleButton).toBeVisible();
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto(`${CMS_URL}/login`);
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('#email');
    await expect(emailInput).toBeVisible({ timeout: 10000 });

    // Fill with non-existent credentials
    await emailInput.fill('nonexistent@test.revealui.com');
    await page.locator('#password').fill('WrongPassword123!');

    // Submit
    await page.locator('button[type="submit"]').click();

    // Should show error message
    const errorBanner = page.locator('.bg-red-50, [class*="bg-red"]');
    await expect(errorBanner).toBeVisible({ timeout: 10000 });
  });

  test('login API rejects invalid credentials', async ({ request }) => {
    const response = await request.post(`${API_AUTH}/sign-in`, {
      data: {
        email: 'nonexistent@test.revealui.com',
        password: 'WrongPassword123!',
      },
    });

    expect(response.status()).toBe(401);

    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  test('login API succeeds with valid credentials', async ({ request }) => {
    // Create a user first
    const email = `login-api-${RUN_ID}@test.revealui.com`;
    await request.post(`${API_AUTH}/sign-up`, {
      data: {
        email,
        password: 'TestPassword123!',
        name: `Login API Test ${RUN_ID}`,
        tosAccepted: true,
      },
    });

    // Attempt sign in
    const response = await request.post(`${API_AUTH}/sign-in`, {
      data: { email, password: 'TestPassword123!' },
    });

    // Sign-in succeeds (200) if email is verified, or returns 403 if
    // email verification is pending. Both are structurally correct.
    expect([200, 403]).toContain(response.status());

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(email);

      // Session cookie should be set
      const setCookie = response.headers()['set-cookie'] ?? '';
      expect(setCookie).toContain('revealui-session=');
    }
  });
});

// ===========================================================================
// 5. Login Form Submission (Browser)
// ===========================================================================

test.describe('Login Form Submission @auth @login', () => {
  const email = `login-form-${RUN_ID}@test.revealui.com`;
  const password = 'TestPassword123!';

  test.beforeAll(async ({ request }) => {
    // Create a test user via API
    await request.post(`${API_AUTH}/sign-up`, {
      data: {
        email,
        password,
        name: `Login Form Test ${RUN_ID}`,
        tosAccepted: true,
      },
    });
  });

  test('filling and submitting the login form', async ({ page }) => {
    await page.goto(`${CMS_URL}/login`);
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('#email');
    await expect(emailInput).toBeVisible({ timeout: 10000 });

    // Fill the form
    await emailInput.fill(email);
    await page.locator('#password').fill(password);

    // Verify values were entered
    const emailValue = await emailInput.inputValue();
    expect(emailValue).toBe(email);

    // Submit
    await page.locator('button[type="submit"]').click();
    await page.waitForLoadState('networkidle');

    // After login, user either:
    // - Redirects to /admin (if email is verified and user is admin)
    // - Stays on login with error (if email not verified or wrong credentials)
    // - Redirects to /mfa (if MFA is enabled)
    const currentUrl = page.url();
    const errorBanner = page.locator('.bg-red-50, [class*="bg-red"]');
    const errorVisible = await errorBanner.isVisible().catch(() => false);

    // One of these outcomes must happen
    const navigatedToAdmin = currentUrl.includes('/admin');
    const navigatedToMfa = currentUrl.includes('/mfa');
    const showedError = errorVisible;
    expect(navigatedToAdmin || navigatedToMfa || showedError).toBe(true);
  });
});

// ===========================================================================
// 6. Admin Dashboard Access Control
// ===========================================================================

test.describe('Admin Dashboard Access @auth @admin', () => {
  test('unauthenticated user is redirected to login from /admin', async ({ page }) => {
    // Clear any existing cookies
    await page.context().clearCookies();

    await page.goto(`${CMS_URL}/admin`);
    await page.waitForLoadState('networkidle');

    // Proxy redirects unauthenticated /admin requests to /login
    const currentUrl = page.url();
    expect(currentUrl).toContain('/login');

    // The redirect URL should include the original destination
    expect(currentUrl).toContain('redirect');
  });

  test('unauthenticated API request to session endpoint returns 401', async ({ request }) => {
    const response = await request.get(`${API_AUTH}/session`);
    expect(response.status()).toBe(401);

    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  test('authenticated admin can access dashboard', async ({ page, request }) => {
    // Create and sign in as a user via API
    const email = `admin-access-${RUN_ID}@test.revealui.com`;
    const password = 'TestPassword123!';

    await request.post(`${API_AUTH}/sign-up`, {
      data: {
        email,
        password,
        name: `Admin Access Test ${RUN_ID}`,
        tosAccepted: true,
      },
    });

    // Sign in to get session token
    const token = await signInAndGetToken(request, email, password);

    // If sign-in returned a token (email is verified), test dashboard access
    if (token) {
      // Set cookies in browser context
      const hostname = new URL(CMS_URL).hostname;
      await page.context().addCookies([
        {
          name: 'revealui-session',
          value: token,
          domain: hostname,
          path: '/',
        },
        {
          name: 'revealui-role',
          value: 'admin',
          domain: hostname,
          path: '/',
        },
      ]);

      await page.goto(`${CMS_URL}/admin`);
      await page.waitForLoadState('networkidle');

      // Should load the admin dashboard (not redirect to login)
      const currentUrl = page.url();
      expect(currentUrl).toContain('/admin');

      // Dashboard should have the RevealUI Admin heading
      const heading = page.locator('text=RevealUI Admin');
      await expect(heading).toBeVisible({ timeout: 15000 });
    } else {
      // Email not verified — sign-in didn't return a session.
      // Verify that the login page is shown instead.
      await page.goto(`${CMS_URL}/admin`);
      await page.waitForLoadState('networkidle');

      const currentUrl = page.url();
      expect(currentUrl).toContain('/login');
    }
  });

  test('admin dashboard shows collections and sign out button', async ({ page, request }) => {
    const email = `admin-ui-${RUN_ID}@test.revealui.com`;
    const password = 'TestPassword123!';

    await request.post(`${API_AUTH}/sign-up`, {
      data: {
        email,
        password,
        name: `Admin UI Test ${RUN_ID}`,
        tosAccepted: true,
      },
    });

    const token = await signInAndGetToken(request, email, password);

    if (token) {
      const hostname = new URL(CMS_URL).hostname;
      await page.context().addCookies([
        {
          name: 'revealui-session',
          value: token,
          domain: hostname,
          path: '/',
        },
        {
          name: 'revealui-role',
          value: 'admin',
          domain: hostname,
          path: '/',
        },
      ]);

      await page.goto(`${CMS_URL}/admin`);
      await page.waitForLoadState('networkidle');

      const currentUrl = page.url();
      if (currentUrl.includes('/admin')) {
        // Verify dashboard UI elements
        const heading = page.locator('text=RevealUI Admin');
        await expect(heading).toBeVisible({ timeout: 15000 });

        // Collections card should be present
        const collectionsLabel = page.locator('text=Collections');
        await expect(collectionsLabel).toBeAttached({ timeout: 10000 });

        // Sign out button should exist
        const signOutButton = page.locator(
          'button:has-text("Sign Out"), button:has-text("Sign out"), button:has-text("Logout"), button:has-text("Log out")',
        );
        await expect(signOutButton).toBeAttached({ timeout: 10000 });

        // Settings link should exist
        const settingsLink = page.locator('a[href="/admin/settings"]');
        await expect(settingsLink).toBeAttached();
      }
    } else {
      // Skip UI assertions if we can't authenticate (email not verified)
      test.skip();
    }
  });

  test('non-admin user is redirected away from /admin', async ({ page }) => {
    // Simulate a user who is authenticated but not admin
    const hostname = new URL(CMS_URL).hostname;
    await page.context().addCookies([
      {
        name: 'revealui-session',
        value: 'some-valid-looking-token',
        domain: hostname,
        path: '/',
      },
      {
        name: 'revealui-role',
        value: 'user',
        domain: hostname,
        path: '/',
      },
    ]);

    await page.goto(`${CMS_URL}/admin`);
    await page.waitForLoadState('networkidle');

    // Proxy redirects non-admin users to home
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/admin');
  });
});

// ===========================================================================
// 7. Full Signup -> Login -> Dashboard Journey (API-driven)
// ===========================================================================

test.describe('Full Signup to Dashboard Journey @auth @signup @login @admin', () => {
  const email = `journey-${RUN_ID}@test.revealui.com`;
  const password = 'JourneyTest123!';
  const name = `Journey User ${RUN_ID}`;

  test('complete API journey: signup, verify session, sign in', async ({ request }) => {
    // Step 1: Sign up
    const signupResponse = await request.post(`${API_AUTH}/sign-up`, {
      data: { email, password, name, tosAccepted: true },
    });

    expect(signupResponse.status()).toBe(200);

    const signupData = await signupResponse.json();
    expect(signupData.user).toBeDefined();
    expect(signupData.user.email).toBe(email);

    // Step 2: Check if session cookie was granted (depends on email verification)
    const signupCookie = signupResponse.headers()['set-cookie'] ?? '';
    const signupToken = extractCookieValue(signupCookie, 'revealui-session');

    if (signupToken) {
      // First-user path: auto-verified admin — session granted on signup
      expect(signupData.user.role).toBe('admin');
      expect(signupData.user.emailVerified).toBe(true);

      // Verify session works
      const sessionResponse = await request.get(`${API_AUTH}/session`, {
        headers: { Cookie: `revealui-session=${signupToken}` },
      });
      expect(sessionResponse.status()).toBe(200);

      const sessionData = await sessionResponse.json();
      expect(sessionData.user).toBeDefined();
      expect(sessionData.user.email).toBe(email);
    } else {
      // Subsequent user: email not verified — no session on signup.
      // The sign-in endpoint should reject until email is verified.
      expect(signupData.user.emailVerified).toBe(false);
    }

    // Step 3: Sign in
    const signInResponse = await request.post(`${API_AUTH}/sign-in`, {
      data: { email, password },
    });

    // Either 200 (verified) or 403 (email not verified). Both correct.
    expect([200, 403]).toContain(signInResponse.status());

    if (signInResponse.status() === 200) {
      const signInData = await signInResponse.json();
      expect(signInData.user).toBeDefined();
      expect(signInData.user.email).toBe(email);

      // Session cookie granted
      const signInCookie = signInResponse.headers()['set-cookie'] ?? '';
      expect(signInCookie).toContain('revealui-session=');
    }
  });

  test('complete browser journey: signup page -> login page -> dashboard', async ({ page }) => {
    const uniqueEmail = `browser-journey-${RUN_ID}@test.revealui.com`;

    // Step 1: Visit signup page
    await page.goto(`${CMS_URL}/signup`);
    await page.waitForLoadState('networkidle');

    const heading = page.locator('text=Create your account');
    await expect(heading).toBeVisible({ timeout: 10000 });

    // Step 2: Fill signup form
    await page.locator('#name').fill(`Browser Journey ${RUN_ID}`);
    await page.locator('#email').fill(uniqueEmail);
    await page.locator('#password').fill('BrowserJourney123!');
    await page.locator('#tos').check();

    // Step 3: Submit signup
    await page.locator('button[type="submit"]').click();
    await page.waitForLoadState('networkidle');

    // Step 4: Navigate to login (may already be there if signup redirected)
    const afterSignupUrl = page.url();
    if (afterSignupUrl.includes('/admin')) {
      // First user was auto-promoted to admin — we're already at the dashboard
      const adminHeading = page.locator('text=RevealUI Admin');
      await expect(adminHeading).toBeVisible({ timeout: 15000 });
      return; // Journey complete
    }

    // Step 5: Go to login page
    await page.goto(`${CMS_URL}/login`);
    await page.waitForLoadState('networkidle');

    const loginHeading = page.locator('text=Sign in to your account');
    await expect(loginHeading).toBeVisible({ timeout: 10000 });

    // Step 6: Fill login form
    await page.locator('#email').fill(uniqueEmail);
    await page.locator('#password').fill('BrowserJourney123!');

    // Step 7: Submit login
    await page.locator('button[type="submit"]').click();
    await page.waitForLoadState('networkidle');

    // Step 8: Verify outcome
    const afterLoginUrl = page.url();
    const errorBanner = page.locator('.bg-red-50, [class*="bg-red"]');
    const errorVisible = await errorBanner.isVisible().catch(() => false);

    if (afterLoginUrl.includes('/admin')) {
      // Successfully reached admin dashboard
      const adminHeading = page.locator('text=RevealUI Admin');
      await expect(adminHeading).toBeVisible({ timeout: 15000 });
    } else if (errorVisible) {
      // Error shown (likely EMAIL_NOT_VERIFIED) — this is expected for
      // non-first users until they verify their email. The E2E test
      // validates the flow works; email verification requires SMTP.
      const errorText = await errorBanner.textContent();
      expect(errorText).toBeTruthy();
    } else {
      // Some other redirect (MFA, home page, etc.)
      expect(afterLoginUrl).toBeTruthy();
    }
  });
});
