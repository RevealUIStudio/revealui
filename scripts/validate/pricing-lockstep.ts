#!/usr/bin/env tsx
/**
 * Pricing lockstep gate -- cross-checks the Stripe seed CATALOG (cents-of-record)
 * against the marketing client-display fallbacks so the two cannot silently
 * drift. The server-side fallback is gated by apps/server's own pricing tests;
 * the human source of truth is .jv/business/offerings-canonical.md.
 *
 * Usage:
 *   tsx scripts/validate/pricing-lockstep.ts          # exit 1 on drift
 *   tsx scripts/validate/pricing-lockstep.ts --warn   # warn-only (exit 0)
 */
import {
  ANNUAL_SUBSCRIPTION_PRICE_FALLBACKS,
  PERPETUAL_PRICE_FALLBACKS,
  SUBSCRIPTION_PRICE_FALLBACKS,
} from '../../apps/marketing/app/lib/pricing-fallbacks.js';
import { CATALOG } from '../setup/stripe-catalog.js';

const warnOnly = process.argv.includes('--warn');

/** "$1,499" -> 149900 cents. No regex (hardline): strip $ and commas, parse. */
function dollarsToCents(value: string): number {
  const cleaned = value.replaceAll('$', '').replaceAll(',', '').trim();
  return Math.round(Number.parseFloat(cleaned) * 100);
}

function catalogCents(key: string): number | undefined {
  for (const product of CATALOG) {
    for (const price of product.prices) {
      if (price.key === key) return price.unitAmount;
    }
  }
  return undefined;
}

interface Mismatch {
  surface: string;
  tier: string;
  fallback: string;
  fallbackCents: number;
  catalogKey: string;
  catalogCents: number | undefined;
}

const mismatches: Mismatch[] = [];

const SUB_KEY: Record<string, string> = {
  pro: 'revealui_pro_monthly',
  max: 'revealui_max_monthly',
  enterprise: 'revealui_enterprise_monthly',
};
for (const [tier, key] of Object.entries(SUB_KEY)) {
  const fb = SUBSCRIPTION_PRICE_FALLBACKS[tier as keyof typeof SUBSCRIPTION_PRICE_FALLBACKS];
  if (!fb) continue;
  const fallbackCents = dollarsToCents(fb.price);
  const declared = catalogCents(key);
  if (declared !== fallbackCents) {
    mismatches.push({
      surface: 'subscription',
      tier,
      fallback: fb.price,
      fallbackCents,
      catalogKey: key,
      catalogCents: declared,
    });
  }
}

const ANNUAL_SUB_KEY: Record<string, string> = {
  pro: 'revealui_pro_yearly',
  max: 'revealui_max_yearly',
  enterprise: 'revealui_enterprise_yearly',
};
for (const [tier, key] of Object.entries(ANNUAL_SUB_KEY)) {
  const fb =
    ANNUAL_SUBSCRIPTION_PRICE_FALLBACKS[tier as keyof typeof ANNUAL_SUBSCRIPTION_PRICE_FALLBACKS];
  if (!fb?.price || fb.price === '$0') continue;
  const fallbackCents = dollarsToCents(fb.price);
  const declared = catalogCents(key);
  if (declared !== fallbackCents) {
    mismatches.push({
      surface: 'subscription-annual',
      tier,
      fallback: fb.price,
      fallbackCents,
      catalogKey: key,
      catalogCents: declared,
    });
  }
}

const PERP_KEY: Record<string, string> = {
  'Pro Perpetual': 'revealui_pro_perpetual',
  'Agency Perpetual': 'revealui_max_perpetual',
  'Enterprise Perpetual': 'revealui_enterprise_perpetual',
};
for (const [name, key] of Object.entries(PERP_KEY)) {
  const fb = PERPETUAL_PRICE_FALLBACKS[name];
  if (!fb) continue;
  const fallbackCents = dollarsToCents(fb.price);
  const declared = catalogCents(key);
  if (declared !== fallbackCents) {
    mismatches.push({
      surface: 'perpetual',
      tier: name,
      fallback: fb.price,
      fallbackCents,
      catalogKey: key,
      catalogCents: declared,
    });
  }
}

if (mismatches.length === 0) {
  console.log('  OK: seed CATALOG cents match the marketing display fallbacks');
  process.exit(0);
}

console.log(
  `  ${warnOnly ? 'WARN' : 'DRIFT'}: ${mismatches.length} surface(s) disagree with the seed CATALOG:`,
);
for (const m of mismatches) {
  console.log(
    `    [${m.surface}] ${m.tier}: fallback ${m.fallback} (${m.fallbackCents}) != CATALOG ${m.catalogKey} (${m.catalogCents ?? 'MISSING'})`,
  );
}
console.log(
  '  Update offerings-canonical.md + ALL surfaces in lockstep (see pricing-fallbacks.ts header).',
);
process.exit(warnOnly ? 0 : 1);
