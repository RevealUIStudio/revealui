/**
 * Billing Paid Path E2E — Stripe go-live item A1 + unified-license item A9
 *
 * ─── WHAT THIS PROVES ────────────────────────────────────────────────────────
 * A throwaway FREE user signs up, calls POST /api/billing/checkout to create a
 * Stripe Checkout session and — crucially — to persist a Stripe customer record
 * linked to that user. We then create a real test subscription via the Stripe
 * SDK, synthesize a signed checkout.session.completed webhook, fire it at the
 * real handler, and assert that GET /api/billing/subscription eventually returns
 * a non-null licenseKey. The A9 (unified-license) assertion then decodes the JWT
 * and verifies the claim shape that the RevDev daemon verifier requires; with
 * REVDEV_LICENSE_PUBLIC_KEY present it also performs a full signature
 * verification via jose.
 *
 * ─── WHY WE SYNTHESIZE + SIGN THE EVENT ─────────────────────────────────────
 * `stripe trigger checkout.session.completed` fires a generic event against a
 * Stripe-controlled test customer — it has no knowledge of our user's UUID or
 * the specific Stripe customer we just created. Without session.metadata
 * containing { tier, revealui_user_id }, the webhook handler cannot resolve the
 * user and throws a 500. We therefore build the event object ourselves, sign it
 * with generateTestHeaderString (exactly the SDK-blessed approach), and send the
 * raw bytes. The handler's constructEventAsync validates the HMAC before reading
 * any field, so this is cryptographically identical to a real Stripe delivery.
 *
 * ─── DETERMINISTIC CI PROOF ──────────────────────────────────────────────────
 * The unit-level proof lives in:
 *   apps/server/src/routes/__tests__/webhook-license-roundtrip.test.ts
 * It exercises the same handler with an in-process DB (no Stripe network calls).
 * This e2e file is the live-creds layer on top — it confirms the integration
 * works end-to-end with real Stripe test objects.
 *
 * ─── THROWAWAY USER ISOLATION ────────────────────────────────────────────────
 * The test creates its own user in-spec (not in global-setup.ts) so it is fully
 * self-contained and can be run in any environment without polluting shared
 * fixtures. The user email uses a timestamped prefix to avoid collisions.
 * Signups must be open (REVEALUI_SIGNUP_OPEN=true or equivalent) in the target
 * environment; the test skips cleanly with a message when signups are restricted.
 *
 * ─── KNOWN DESIGN TENSION (subscription endpoint + hosted path) ──────────────
 * GET /api/billing/subscription returns licenseKey from the `licenses` table
 * ONLY when neither requestEntitlements nor the hosted accountEntitlements path
 * resolves. Since the webhook's saga calls syncHostedSubscriptionState (creating
 * accountMemberships + accountEntitlements) in the same saga as inserting into
 * `licenses`, after the webhook runs the hosted path will short-circuit and
 * return licenseKey: null. If this test's poll times out, that is the likely
 * cause — the hosted path returns before reaching the licenses table query. This
 * is a known design gap to resolve in a follow-up. The A9 assertion is still
 * exercised whenever the poll succeeds.
 *
 * ─── REQUIRED ENV VARS ───────────────────────────────────────────────────────
 *   STRIPE_SECRET_KEY          sk_test_... (Stripe test key — never charged)
 *   STRIPE_WEBHOOK_SECRET      whsec_...  (test webhook signing secret)
 *
 * ─── OPTIONAL ENV VARS ───────────────────────────────────────────────────────
 *   STRIPE_PRO_PRICE_ID            or NEXT_PUBLIC_STRIPE_PRO_PRICE_ID
 *   REVDEV_LICENSE_PUBLIC_KEY      EdDSA public key (SPKI PEM) for A9 sig verify
 *   API_BASE_URL                   defaults to http://localhost:3004
 *   PLAYWRIGHT_BASE_URL            defaults to http://localhost:4000
 *
 * Run:
 *   STRIPE_SECRET_KEY=sk_test_... \
 *   STRIPE_WEBHOOK_SECRET=whsec_... \
 *   STRIPE_PRO_PRICE_ID=price_... \
 *   pnpm test:e2e -- --project=chromium e2e/billing-paid-path.e2e.ts
 */

import { expect, test } from '@playwright/test';
import Stripe from 'stripe';

// ─── Config ──────────────────────────────────────────────────────────────────

function stripTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

/** `admin.revealui.com` -> `.revealui.com` so the cookie is sent cross-subdomain. */
function crossSubdomainDomain(hostname: string): string {
  const firstDot = hostname.indexOf('.');
  return firstDot === -1 ? hostname : hostname.substring(firstDot);
}

const ApiBase = stripTrailingSlash(process.env.API_BASE_URL ?? 'http://localhost:3004');
const AdminBase = stripTrailingSlash(process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4000');

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? '';

const hasStripeKey = STRIPE_SECRET_KEY.startsWith('sk_test_');
const hasWebhookSecret = !!STRIPE_WEBHOOK_SECRET;

const PRICE_ID =
  process.env.STRIPE_PRO_PRICE_ID ?? process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID ?? '';

const SESSION_COOKIE_NAME = 'revealui-session';
const CSRF_COOKIE_NAME = 'revealui-csrf';

// ─── Suite-level gate ────────────────────────────────────────────────────────

test.describe('Billing paid path — live creds E2E', { tag: '@billing-paid-path' }, () => {
  test.skip(
    !(hasStripeKey && hasWebhookSecret),
    'Requires STRIPE_SECRET_KEY=sk_test_... and STRIPE_WEBHOOK_SECRET',
  );

  // Shared state threaded through the single test via closure vars in afterAll
  let createdCustomerId: string | null = null;
  let createdSubscriptionId: string | null = null;

  test.afterAll(async () => {
    if (!(hasStripeKey && hasWebhookSecret)) return;
    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: Stripe.API_VERSION });
    if (createdSubscriptionId) {
      await stripe.subscriptions.cancel(createdSubscriptionId).catch(() => {
        // best-effort cleanup — never throw in afterAll
      });
    }
    if (createdCustomerId) {
      await stripe.customers.del(createdCustomerId).catch(() => {
        // best-effort cleanup — never throw in afterAll
      });
    }
  });

  test('new user completes paid path and receives a signed license JWT', async ({ page }) => {
    test.setTimeout(60_000);

    // ── 0. Gate: price ID must be configured ─────────────────────────────
    test.skip(!PRICE_ID, 'Requires STRIPE_PRO_PRICE_ID or NEXT_PUBLIC_STRIPE_PRO_PRICE_ID');

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: Stripe.API_VERSION });

    // ── 1. Create throwaway user ──────────────────────────────────────────
    const uniqueMs = Date.now();
    const email = `paidpath+${uniqueMs}@e2e.revealui.test`;
    const password = `e2e-pwd-${uniqueMs}`;
    const name = 'E2E Paid Path';

    const signupRes = await page.request.post(`${ApiBase}/api/auth/signup`, {
      data: { email, password, name },
      headers: { 'Content-Type': 'application/json' },
    });

    if (signupRes.status() === 403) {
      test.skip(true, 'Signups are restricted on this environment (REVEALUI_SIGNUP_OPEN not set)');
      return;
    }

    expect(signupRes.status(), 'signup must return 201').toBe(201);
    const signupBody = (await signupRes.json()) as {
      success: boolean;
      user: { id: string; email: string };
    };
    expect(signupBody.success).toBe(true);
    const userId = signupBody.user.id;
    expect(typeof userId).toBe('string');

    // ── 2. Sign in to obtain session cookie ──────────────────────────────
    const signinRes = await page.request.post(`${AdminBase}/api/auth/sign-in`, {
      data: { email, password },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(signinRes.ok(), `sign-in failed with HTTP ${signinRes.status()}`).toBe(true);

    // The sign-in response populates the context jar; select the session
    // cookie by name (index 0 may be `revealui-role`, not the session).
    const contextCookies = await page.context().cookies(AdminBase);
    const sessionCookie = contextCookies.find((c) => c.name === SESSION_COOKIE_NAME);
    expect(sessionCookie, 'revealui-session cookie must be set after sign-in').toBeTruthy();
    if (!sessionCookie) return;

    const cookieHeader = `${sessionCookie.name}=${sessionCookie.value}`;

    // Rehydrate the cookie into the context with the correct cross-subdomain
    // domain so subsequent requests carry it.
    await page.context().addCookies([
      {
        name: sessionCookie.name,
        value: sessionCookie.value,
        domain: crossSubdomainDomain(new URL(AdminBase).hostname),
        path: '/',
        expires: sessionCookie.expires ?? -1,
        httpOnly: true,
        secure: AdminBase.startsWith('https'),
        sameSite: 'Lax',
      },
    ]);

    // ── 3. Mint CSRF token via an authenticated admin page ───────────────
    // The admin proxy sets the non-httpOnly `revealui-csrf` cookie on any
    // authenticated admin response; decode it to match the header the browser
    // sends in `X-CSRF-Token`.
    await page.request
      .get(`${AdminBase}/account/billing`, {
        headers: { cookie: cookieHeader },
      })
      .catch(() => undefined);
    const allCookies = await page.context().cookies(AdminBase);
    const csrfCookie = allCookies.find((c) => c.name === CSRF_COOKIE_NAME);
    const csrfToken = csrfCookie ? decodeURIComponent(csrfCookie.value) : '';

    // ── 4. POST /api/billing/checkout to create Stripe customer ──────────
    const checkoutRes = await page.request.post(`${ApiBase}/api/billing/checkout`, {
      data: { tier: 'pro' },
      headers: {
        'Content-Type': 'application/json',
        cookie: cookieHeader,
        'X-CSRF-Token': csrfToken,
      },
    });

    expect(checkoutRes.status(), `checkout must return 200, got ${checkoutRes.status()}`).toBe(200);

    const checkoutBody = (await checkoutRes.json()) as { url: string };
    expect(checkoutBody.url, 'checkout response must include a Stripe URL').toBeTruthy();
    expect(
      checkoutBody.url.startsWith('https://checkout.stripe.com/'),
      'checkout URL must start with https://checkout.stripe.com/',
    ).toBe(true);

    // ── 5. Locate the Stripe customer and create a real test subscription ─
    // The checkout call above called ensureStripeCustomer which created (or
    // found) a Stripe customer with this user's email. Look it up by email.
    const customerList = await stripe.customers.list({ email, limit: 1 });
    expect(
      customerList.data.length,
      'Stripe customer must exist after checkout call',
    ).toBeGreaterThan(0);
    const customerId = customerList.data[0]?.id;
    expect(typeof customerId).toBe('string');
    if (!customerId) return;
    createdCustomerId = customerId;

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: PRICE_ID }],
      trial_period_days: 7,
    });
    createdSubscriptionId = subscription.id;

    // ── 6. Build, sign, and POST a checkout.session.completed webhook ─────
    const eventId = `evt_e2e_${uniqueMs}`;
    const event = {
      id: eventId,
      type: 'checkout.session.completed',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          id: 'cs_test_e2e',
          object: 'checkout.session',
          mode: 'subscription',
          customer: customerId,
          subscription: subscription.id,
          customer_email: email,
          payment_status: 'paid',
          status: 'complete',
          metadata: {
            tier: 'pro',
            revealui_user_id: userId,
          },
        },
      },
    };

    const payload = JSON.stringify(event);
    const header = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: STRIPE_WEBHOOK_SECRET,
    });

    const webhookRes = await page.request.post(`${ApiBase}/api/webhooks/stripe`, {
      data: payload,
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': header,
      },
    });

    expect(webhookRes.status(), `webhook must return 200, got ${webhookRes.status()}`).toBe(200);

    // ── 7. Poll GET /api/billing/subscription until licenseKey is non-null ─
    const pollStart = Date.now();
    const pollTimeout = 25_000;
    const pollInterval = 1_000;
    let licenseKey: string | null = null;
    let subscriptionTier: string | null = null;

    while (Date.now() - pollStart < pollTimeout) {
      const subRes = await page.request.get(`${ApiBase}/api/billing/subscription`, {
        headers: { cookie: cookieHeader },
      });

      if (subRes.ok()) {
        const subBody = (await subRes.json()) as {
          tier: string;
          status: string;
          expiresAt: string | null;
          licenseKey: string | null;
        };

        if (typeof subBody.licenseKey === 'string' && subBody.licenseKey.length > 0) {
          licenseKey = subBody.licenseKey;
          subscriptionTier = subBody.tier;
          break;
        }
      }

      await new Promise<void>((resolve) => setTimeout(resolve, pollInterval));
    }

    expect(
      licenseKey,
      'GET /api/billing/subscription must return a non-null licenseKey within 25s. ' +
        'If this times out, the hosted-entitlement path may be short-circuiting before ' +
        'the licenses table query — see the KNOWN DESIGN TENSION note in the file comment.',
    ).not.toBeNull();
    expect(typeof licenseKey).toBe('string');

    expect(subscriptionTier, 'subscription tier must be pro').toBe('pro');

    // ── 8. A9 assertion — daemon-verifiable JWT claim shape ───────────────
    // Decode the JWT without a library: split on '.', base64url-decode each
    // segment via Buffer (no regex; M2 rule prohibits authored regex).
    const segments = (licenseKey as string).split('.');
    expect(segments.length, 'licenseKey must be a three-segment JWT').toBe(3);

    function decodeBase64Url(segment: string): unknown {
      // Base64url -> base64: replace - with + and _ with /
      const base64 = segment.split('-').join('+').split('_').join('/');
      return JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
    }

    const jwtHeader = decodeBase64Url(segments[0]) as Record<string, unknown>;
    const jwtPayload = decodeBase64Url(segments[1]) as Record<string, unknown>;

    // Header shape: daemon requires EdDSA algorithm
    expect(jwtHeader.alg, 'JWT header.alg must be EdDSA').toBe('EdDSA');

    // Payload claims: exact values the RevDev daemon verifier checks
    expect(jwtPayload.iss, 'JWT payload.iss must be https://revealui.com').toBe(
      'https://revealui.com',
    );
    expect(jwtPayload.aud, 'JWT payload.aud must be revealui-license').toBe('revealui-license');
    expect(jwtPayload.tier, 'JWT payload.tier must be pro').toBe('pro');

    // Optional: real signature verification when the daemon public key is present
    const publicKeyPem = process.env.REVDEV_LICENSE_PUBLIC_KEY ?? '';
    if (!publicKeyPem) {
      // Log a note so CI operators know the sub-assertion was skipped
      console.info(
        '[billing-paid-path] REVDEV_LICENSE_PUBLIC_KEY not set — skipping EdDSA signature ' +
          'verification. Set the env var with the daemon verifier public key (SPKI PEM) to ' +
          'enable the full A9 roundtrip assertion.',
      );
    } else {
      const { importSPKI, jwtVerify } = await import('jose');
      const publicKey = await importSPKI(publicKeyPem, 'EdDSA');
      // jwtVerify throws on an invalid signature/issuer/audience, failing the
      // test; on success assert the verified payload still carries the tier.
      const verified = await jwtVerify(licenseKey as string, publicKey, {
        issuer: 'https://revealui.com',
        audience: 'revealui-license',
      });
      expect(verified.payload.tier, 'daemon-verifiable JWT must carry tier=pro').toBe('pro');
    }
  });
});
