#!/usr/bin/env tsx

/**
 * Seed the GAP-434 Starter Kit first-month-of-Pro coupon (idempotent).
 *
 * Creates:
 *   - Coupon starter_kit_pro_month_1 (100% off, once)
 *   - Promotion code STARTERKITPRO1
 *
 * Usage:
 *   export STRIPE_SECRET_KEY="$(revvault get --full revealui/prod/stripe/secret-key)"
 *   # or test: revealui/dev/stripe/secret-key
 *   pnpm stripe:seed:starter-kit-coupon              # apply
 *   pnpm stripe:seed:starter-kit-coupon -- --dry-run # preview
 *   pnpm stripe:seed:starter-kit-coupon -- --check   # exit 1 if missing
 *
 * Does not store the coupon id in env (code is human-distributed). Optional
 * later: write id to SECRETS.md / revvault for automation.
 */

import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import type Stripe from 'stripe';
import { STARTER_KIT_PRO_COUPON } from './starter-kit-pro-coupon.js';

config({ path: resolve(import.meta.dirname, '../../.env') });

const require = createRequire(resolve(import.meta.dirname, '../../packages/services/'));
const stripeModule = require('stripe') as { default?: typeof Stripe } & typeof Stripe;
const StripeConstructor = (stripeModule.default ?? stripeModule) as typeof Stripe;

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const checkOnly = args.has('--check');

function secretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim() || process.env.STRIPE_API_KEY?.trim();
  if (!key) {
    throw new Error(
      'STRIPE_SECRET_KEY (or STRIPE_API_KEY) required. Prefer:\n' +
        '  export STRIPE_SECRET_KEY="$(revvault get --full revealui/prod/stripe/secret-key)"',
    );
  }
  if (!(key.startsWith('sk_live_') || key.startsWith('sk_test_') || key.startsWith('rk_'))) {
    throw new Error('STRIPE_SECRET_KEY does not look like a Stripe secret/restricted key');
  }
  return key;
}

async function findPromotionCode(
  stripe: Stripe,
  couponId: string,
  code: string,
): Promise<Stripe.PromotionCode | null> {
  // Prefer list by coupon; fall back to code match across pages (small volume).
  const listed = await stripe.promotionCodes.list({ coupon: couponId, limit: 100 });
  const match = listed.data.find((p) => p.code === code);
  if (match) return match;
  return null;
}

async function main(): Promise<void> {
  const key = secretKey();
  const stripe = new StripeConstructor(key, {
    apiVersion: StripeConstructor.API_VERSION,
    typescript: true,
  });

  const { couponId, name, percentOff, duration, promotionCode } = STARTER_KIT_PRO_COUPON;
  const mode = key.startsWith('sk_live_') || key.startsWith('rk_live') ? 'live' : 'test';

  console.log(
    `\n── GAP-434 Starter Kit Pro coupon (${mode}${dryRun ? ', dry-run' : ''}${checkOnly ? ', check' : ''}) ──\n`,
  );

  let coupon: Stripe.Coupon | null = null;
  try {
    coupon = await stripe.coupons.retrieve(couponId);
    console.log(`  ✓ coupon exists: ${couponId} (${coupon.percent_off}% off, ${coupon.duration})`);
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status !== 404) throw err;
    console.log(`  · coupon missing: ${couponId}`);
  }

  if (checkOnly) {
    const promo = coupon ? await findPromotionCode(stripe, couponId, promotionCode) : null;
    if (coupon && promo?.active) {
      console.log(`  ✓ promotion code exists: ${promotionCode}`);
      console.log('\ncheck: OK\n');
      return;
    }
    console.error('\ncheck: FAIL — coupon and/or promotion code missing\n');
    process.exit(1);
  }

  if (!coupon) {
    if (dryRun) {
      console.log(`  [dry-run] would create coupon ${couponId}`);
    } else {
      coupon = await stripe.coupons.create({
        id: couponId,
        name,
        percent_off: percentOff,
        duration,
        metadata: {
          revealui_gap: 'GAP-434',
          revealui_purpose: 'starter_kit_first_pro_month',
        },
      });
      console.log(`  ✓ created coupon: ${coupon.id}`);
    }
  }

  const existingPromo = coupon ? await findPromotionCode(stripe, couponId, promotionCode) : null;
  if (existingPromo) {
    console.log(
      `  ✓ promotion code exists: ${promotionCode} (${existingPromo.active ? 'active' : 'inactive'}) id=${existingPromo.id}`,
    );
  } else if (dryRun) {
    console.log(`  [dry-run] would create promotion code ${promotionCode}`);
  } else if (!coupon) {
    throw new Error('internal: coupon required before promotion code');
  } else {
    const promo = await stripe.promotionCodes.create({
      coupon: couponId,
      code: promotionCode,
      metadata: {
        revealui_gap: 'GAP-434',
        revealui_purpose: 'starter_kit_first_pro_month',
      },
    });
    console.log(`  ✓ created promotion code: ${promo.code} id=${promo.id}`);
  }

  console.log(`
Done. Fulfillment: email ${promotionCode} with the GitHub invite to
RevealUIStudio/revealui-starter-kit after each $299 sale.

Verify:
  pnpm stripe:seed:starter-kit-coupon -- --check
`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
