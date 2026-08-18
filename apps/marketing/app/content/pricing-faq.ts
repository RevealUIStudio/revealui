// 2026-07-12 claims-ratchet 2: FAQ prose is code-indexed in claims-evidence.ts;
// the overage-billing and open-weight-model answers corrected to match shipped
// code (no pre-overage dashboard; model names generalized).
// Sourced from: app/routes/PricingPage.tsx (Phase 1, no copy changes). Per the internal marketing-overhaul plan §4.4.

import { SITE } from './site';
import type { FaqItem } from './types';

export const PRICING_FAQ_SECTION = {
  heading: 'Frequently Asked Questions',
} as const;

export const PRICING_FAQS: readonly FaqItem[] = [
  {
    question: 'Can I use the Free tier for commercial projects?',
    answer:
      'Yes. The Free tier is fully open-source (MIT) and can be used for commercial projects. You get full source code access and can deploy it anywhere you like.',
  },
  {
    question: 'What happens after the free trial ends?',
    answer:
      "Pro and Max tiers include a 7-day free trial. After the trial ends, you'll be charged the monthly rate. You can cancel anytime during the trial without being charged.",
  },
  {
    question: 'How does agent task billing work?',
    answer:
      'Every paid subscription includes a monthly task allowance: 10,000 tasks on Pro, 50,000 on Max, unlimited on Enterprise. Metered overage billing ships later; nothing is charged beyond the allowance today.',
  },
  {
    question: 'What are perpetual licenses?',
    answer:
      'A perpetual license is a one-time purchase that gives you a license key for the corresponding tier, forever, with no monthly subscription required. Support and updates are included for 1 year; after that, renew your support contract or keep using the version you have.',
  },
  {
    question: 'What is the RevealUI Starter Kit?',
    answer:
      'The Starter Kit is a $299 one-time, content-only product. It packages create-revealui onboarding, Postgres bootstrap, and governed agent recipes that demonstrate signed receipts you can verify offline. It does not include a Pro subscription entitlement or a full RevealUI Fleet stamp. Checkout is on Stripe. After purchase we invite you to the private kit repo and Skool buyer community within one business day.',
  },
  {
    question: 'What is the RevealUI Agency Founding Kit?',
    answer:
      'The Agency Founding Kit is the Agency Perpetual license productized for small agencies and MSPs: $8,499 one-time for Max-tier runtime entitlements with up to 10 client deployments, one year of support, and a license key that never expires. You check out through your signed-in account license page on Stripe. It is not the $299 content-only Starter Kit, and it is not the high-touch done-with-you Fleet engagement. A Max monthly subscription remains available if you prefer recurring billing.',
  },
  {
    question: 'Can I upgrade or downgrade my plan?',
    answer: `Yes, you can upgrade your plan at any time. You'll be charged the prorated amount immediately. To downgrade, visit your billing portal or contact ${SITE.emails.support}.`,
  },
  {
    question: 'How does AI inference work?',
    answer:
      'Bring your own model. The default ships open-weight (Gemma-family and other open-weight models) via Ollama or Ubuntu Inference Snaps from Canonical (canonical default, Studio lifecycle pending), so your bill does not scale with usage. Switch to Claude, GPT, or any OpenAI-compatible provider in one config line. The runtime is provider-agnostic; the default is sovereignty-friendly.',
  },
  {
    question: 'What does "full source code access" mean?',
    answer:
      'You get the complete RevealUI source code: every app and package is published in the public monorepo. Infrastructure packages (@revealui/core, auth, db, contracts, security, utils, config, cache, resilience, openapi, sync) are MIT-licensed. The five Pro packages (@revealui/ai, @revealui/engines, @revealui/harnesses, @revealui/mcp, @revealui/services) ship under Fair Source (FSL-1.1-MIT): source is visible, commercial use is permitted except for building a directly competing developer platform, and each release automatically converts to plain MIT two years after publication. All paid tiers add runtime entitlements (license validation, feature gates, priority updates) on top of that source access, and nothing is hidden behind a closed binary.',
  },
  {
    question: 'What is Fair Source (FSL-1.1-MIT)?',
    answer: `Fair Source is a middle path between closed commercial and plain open-source. Our five Pro packages (@revealui/ai, @revealui/engines, @revealui/harnesses, @revealui/mcp, @revealui/services) are source-visible on GitHub, installable from npm, and legally usable in commercial products, with one non-compete clause: you can't ship a substantially similar developer platform that competes with RevealUI on top of them. Two years after each release, that release automatically converts to MIT. Same license model used by Sentry, GitButler, and Keygen. Source-available under FSL: free for everyone except SaaS competitors. Pro plan = hosted infra + support, not npm-level enforcement. Full explainer at /fair-source.`,
  },
  {
    question: 'Do you offer custom pricing for large teams?',
    answer: `Yes. If you need more than what the Enterprise tier offers, contact us at ${SITE.emails.support} to discuss custom pricing. See /sla for our standard support and uptime commitments.`,
  },
  {
    question: 'What is RevFleet?',
    answer:
      'RevFleet is the RevealUI Studio product family: seven products that compose around the RevealUI runtime. RevealUI is the agentic business runtime. RevVault encrypts secrets (CLI MIT, desktop Pro). RevDev is the engineering harness for multi-agent coordination across Claude, Cursor, and Copilot (Studio + Console MIT, Daemon Fair Source). RevCon syncs editor configs (MIT). RevSkills is the Agent Skills library (MIT). RevForge is the operator-side stamping tool that produces white-label trial kits (operator-only). RevMarket is the agent tool marketplace (bundled with the runtime, on the way). Use RevealUI standalone, or compose what you need.',
  },
];
