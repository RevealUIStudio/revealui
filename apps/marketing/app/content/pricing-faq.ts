// Sourced from: app/routes/PricingPage.tsx (Phase 1, no copy changes). Per docs/lanes/marketing-overhaul/plan.md §4.4.

import { SITE } from './site';
import type { FaqItem } from './types';

export const PRICING_FAQ_SECTION = {
  heading: 'Frequently Asked Questions',
} as const;

export const PRICING_FAQS: readonly FaqItem[] = [
  {
    question: 'Can I use the Free tier for commercial projects?',
    answer:
      'Yes! The Free tier is fully open-source (MIT) and can be used for commercial projects. You get full source code access and can deploy it anywhere you like.',
  },
  {
    question: 'What happens after the free trial ends?',
    answer:
      "Pro and Max tiers include a 7-day free trial. After the trial ends, you'll be charged the monthly rate. You can cancel anytime during the trial without being charged.",
  },
  {
    question: 'How does agent task billing work?',
    answer:
      'Every paid subscription includes generous task allowances. Agent task usage billing is coming soon — for now, all tiers include unlimited agent tasks during early access.',
  },
  {
    question: 'What are perpetual licenses?',
    answer:
      'A perpetual license is a one-time purchase that gives you a license key for the corresponding tier, forever, with no monthly subscription required. Support and updates are included for 1 year; after that, renew your support contract or keep using the version you have.',
  },
  {
    question: 'Can I upgrade or downgrade my plan?',
    answer: `Yes, you can upgrade your plan at any time. You'll be charged the prorated amount immediately. To downgrade, visit your billing portal or contact ${SITE.emails.support}.`,
  },
  {
    question: 'How does AI inference work?',
    answer:
      'Bring your own model. The default ships open-weight (Llama 4, Gemma 3, Qwen 3, DeepSeek R1) via Ollama or Ubuntu Inference Snaps from Canonical (canonical default — Studio lifecycle pending) — your bill does not scale with usage. Switch to Claude, GPT, or any provider in one config line. The runtime is provider-agnostic; the default is sovereignty-friendly.',
  },
  {
    question: 'What does "full source code access" mean?',
    answer:
      'You get the complete RevealUI source code — every app and package is published in the public monorepo. Infrastructure packages (@revealui/core, auth, db, contracts, security, utils, config, cache, resilience, openapi, sync, mcp) are MIT-licensed. The two Pro packages (@revealui/ai, @revealui/harnesses) ship under Fair Source (FSL-1.1-MIT): source is visible, commercial use is permitted except for building a directly competing developer platform, and each release automatically converts to plain MIT two years after publication. All paid tiers add runtime entitlements (license validation, feature gates, priority updates) on top of that source access — nothing is hidden behind a closed binary.',
  },
  {
    question: 'What is Fair Source (FSL-1.1-MIT)?',
    answer: `Fair Source is a middle path between closed commercial and plain open-source. Our Pro packages (@revealui/ai and @revealui/harnesses) are source-visible on GitHub, installable from npm, and legally usable in commercial products — with one non-compete clause: you can't ship a substantially similar developer platform that competes with RevealUI on top of them. Two years after each release, that release automatically converts to MIT. Same license model used by Sentry, GitButler, and Keygen. Source-available under FSL: free for everyone except SaaS competitors. Pro plan = hosted infra + support, not npm-level enforcement. Full explainer at /fair-source.`,
  },
  {
    question: 'Do you offer custom pricing for large teams?',
    answer: `Yes! If you need more than what the Enterprise tier offers, contact us at ${SITE.emails.support} to discuss custom pricing and SLAs.`,
  },
  {
    question: 'What is RevFleet?',
    answer:
      'RevFleet is the RevealUI Studio product family — eight products that compose around the RevealUI runtime. RevealUI is the agentic business runtime. RevVault encrypts secrets (CLI MIT, desktop Pro). RevDev is the engineering harness for multi-agent coordination across Claude, Cursor, and Copilot (Studio + Console MIT, Daemon Fair Source). RevCon syncs editor configs (MIT). RevSkills is the Claude Code skills library (MIT). RevForge is the operator-side stamping tool that produces white-label trial kits (operator-only). RevKit is the portable WSL dev environment toolkit (Pro). RevealCoin is x402-compatible agent payments — deployed on Solana mainnet but pre-launch (multisig migration + on-chain vesting gating; see RevealCoin README for the open prerequisites). Use RevealUI standalone, or compose what you need.',
  },
];
