// Content for the standalone /governance page (GovernancePage.tsx) and the
// home/products governance proof beat (PROOF_GOVERNANCE in proof.ts).
//
// Phase F (governance surfaces). Governance is NOT a third pillar (two-pillar
// lock, 00-truth-source §1); it is the sharpened expression of the layer-1
// ownership message ("One runtime you own, with agents you can prove").
// Copy tracks the merged corpus: 06-copy-corpus §2 (sharpened lead) + §4.14
// (governance block) + 00-truth-source §9 (governance capability claims).
//
// Honesty (truth-source §5/§9, binding): feature the CAPABILITY only. No SOC2 /
// ISO / SSO / SCIM claims. No market-size figures. Locked vocab; no em dashes.
// The §4(c) adopters are post-scrub (no Chinese-origin models) and are framed as
// industry adopters of open/local models, NOT RevealUI customers.

import { SITE } from './site';

const AUDIT_HREF = `${SITE.urls.repo}/blob/main/packages/db/src/schema/audit-log.ts`;
const POLICY_HREF = `${SITE.urls.repo}/blob/main/packages/security/src/authorization.ts`;

export interface GovernanceCapability {
  readonly title: string;
  readonly body: string;
  readonly linkLabel: string;
  readonly linkHref: string;
}

export interface GovernanceAdopter {
  readonly name: string;
  readonly detail: string;
  readonly source: string;
}

export const GOVERNANCE_PAGE = {
  eyebrow: 'Provable agent governance',
  h1: 'One runtime you own, with agents you can prove.',
  lead: 'Put agents in front of customers and you get three hard questions: who could see this, who can stop an agent, and can you prove what it did. RevealUI answers all three from the record, not a promise.',
  capabilities: [
    {
      title: 'A tamper-evident audit log',
      body: 'Every action your People and your Agents take signs into a hash-chained (HMAC-SHA256) audit log. Alter one record and the chain breaks, so nothing gets quietly rewritten.',
      linkLabel: 'See the schema',
      linkHref: AUDIT_HREF,
    },
    {
      title: 'One policy over people and agents',
      body: 'A single RBAC + ABAC policy governs your team, your agents, and your service accounts, proven by 59 enforcement tests. Set the rules once; agents inherit the same boundaries.',
      linkLabel: 'See the policy engine',
      linkHref: POLICY_HREF,
    },
  ] as readonly GovernanceCapability[],
  // Verbatim from corpus §4.14 (the sharpened layer-1 governance block).
  block:
    'Every action your People and your Agents take signs into a tamper-evident audit log you can prove was never edited. One set of permission rules governs your team, your agents, and your service accounts. So when a customer asks who could see this, who can stop an agent, and can you prove what it did, the answer is in the record, not a promise.',
  proof: {
    eyebrow: 'Why it matters',
    heading: 'The operators who self-host their models need provable governance on top.',
    body: 'Banks, defense programs, and other regulated operators already run open-weight models on their own infrastructure so data stays in-boundary. Their next question is always governance: who can act, and can you prove what happened. RevealUI is that layer.',
    adopters: [
      {
        name: 'HSBC',
        detail: 'is deploying self-hosted Mistral on its own internal systems in finance.',
        source: 'HSBC, 2025-12-01',
      },
      {
        name: 'Capital One',
        detail: 'runs a production multi-agent assistant on fine-tuned Llama.',
        source: 'Capital One tech blog, 2025-03-05',
      },
      {
        name: 'Scale AI Defense Llama',
        detail: 'fine-tunes Llama 3 for controlled government environments.',
        source: 'Scale, 2024-11-04',
      },
    ] as readonly GovernanceAdopter[],
    disclaimer:
      'These are industry adopters of open and local models, not RevealUI customers. They show the shape of the buyer: self-host the model, then need provable governance on top.',
  },
  // Capability-not-certification honesty, framed positively (no cert name-drops).
  honesty:
    'Governance here is a technical capability your security team can read in the repo and verify line by line, not a certification you take on trust. RevealUI ships the audit chain and the policy engine; the proof is the code.',
  cta: {
    primary: { label: 'Start building', href: SITE.urls.signup },
    secondary: { label: 'Read the docs', href: SITE.urls.docs },
  },
} as const;

// Home/products governance proof beat. Pairs "their security team can read every
// line" with "and prove what every agent did". Links onward to /governance.
export const PROOF_GOVERNANCE = {
  eyebrow: 'Provable governance',
  heading: 'Read every line, and prove what every agent did.',
  body: 'The whole runtime is open source in the repo, and every action by a person or an agent signs into a tamper-evident hash chain governed by one RBAC + ABAC policy. The answer to who did what is in the record, not a promise.',
  linkLabel: 'See provable governance →',
  linkHref: '/governance',
} as const;
