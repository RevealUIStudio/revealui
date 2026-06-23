// Content for the Local-first AI home section (LocalAi.tsx) and the standalone
// /local-ai page (LocalAiPage.tsx).
//
// Copy is locked to the merged Phase B corpus:
//   - docs/marketing/06-copy-corpus.md §4.11 (frontier pathway), §4.12 (local-first AI)
//   - docs/marketing/00-truth-source.md §8 (local-first AI grounding), §4(c) (named adopters)
// If this file drifts from the corpus, this file is wrong and gets fixed here
// first (corpus §0 authority rule).
//
// Honesty guardrails (truth-source §5, binding): open-model-first is framed on
// cost + sovereignty + good-enough-for-most-work economics, NEVER on parity,
// "free", "turnkey", or "faster". Frontier stays the opt-in escalation. The
// provider snippet is grep-accurate to packages/ai/src/llm/client.ts
// (LLM_PROVIDER; inference-snaps default gemma3 :9090, ollama gemma4 :11434).
// Positioning guardrail (Phase C): ownership stays the lead; local AI is its proof.

import { SITE } from './site';

export interface LocalAiBeat {
  readonly title: string;
  readonly body: string;
}

// Shared home-section content. Four beats per the corpus §4.12 lead.
export const LOCAL_AI_SECTION = {
  eyebrow: 'Local-first AI',
  heading: 'Your agents run on models you own.',
  body: 'Your Agents run on open-weight models on your own infrastructure by default. The content they read and write never leaves your boundary, your AI bill is your own inference cost, and the same permissions and audit log cover every action.',
  beats: [
    {
      title: 'Sovereignty',
      body: 'The content your agents read and write never leaves your boundary. In the default config, inference runs on infrastructure you own.',
    },
    {
      title: 'Economics',
      body: 'Your AI bill is your own inference cost, not a per-token tax that grows with every customer.',
    },
    {
      title: 'Pathway',
      body: 'When you want a frontier model, add it in one config line: opt-in, never assumed.',
    },
    {
      title: 'Governance',
      body: 'Either way, the same permissions govern every action and the same audit log records it.',
    },
  ] as readonly LocalAiBeat[],
  // Grep-accurate to packages/ai/src/llm/client.ts createLLMClientFromEnv().
  snippet: {
    caption:
      'One line picks your model runner. Frontier providers stay opt-in adapters, never the default.',
    lines: [
      {
        code: 'LLM_PROVIDER=inference-snaps',
        note: 'gemma3 on your box, port 9090 (default runner)',
      },
      { code: 'LLM_PROVIDER=ollama', note: 'gemma4 on your box, port 11434' },
    ],
  },
  dogfood:
    'RevDev Studio, the harness the team uses to build RevealUI, ships a local-inference cockpit that installs and runs Inference Snaps and Ollama. The team that maintains RevealUI runs local inference.',
  honesty:
    'Local inference needs an open-weight model runner (Ollama or Ubuntu Inference Snaps) and adequate hardware. Frontier models still lead the hardest work, which is why they are one config line away.',
  cta: { label: 'See local-first AI', href: '/local-ai' },
} as const;

export interface LocalAdopter {
  readonly name: string;
  readonly detail: string;
  readonly source: string;
}

// Standalone /local-ai page. Consolidates the scattered strong lines plus the
// §4(c) named-adopter MARKET proof (industry adopters of open/local models, NOT
// RevealUI customers) and the air-gap roadmap. The opencode pathway is gated to
// Phase E (corpus §4.13) and is intentionally omitted until those docs ship.
export const LOCAL_AI_PAGE = {
  eyebrow: 'Local-first AI',
  h1: 'Run your AI on infrastructure you own.',
  lead: 'RevealUI is open-model first. The runtime needs no hosted model API: it runs on open-weight models by default, and a frontier provider is one opt-in config line, never assumed. Ownership is the lead. Local AI is how you prove it.',
  pillars: [
    {
      title: 'Your data stays in your boundary',
      body: 'In the default config, agents run on an open-weight model on your own infrastructure, so the content they read and write never leaves your boundary. No hosted model API sits between your code and your business logic.',
    },
    {
      title: 'Your inference cost, not a per-token tax',
      body: 'You pay for your own inference and compute, not a per-token fee that grows with every customer you add. Frontier API prices have moved up; commodity and local inference keep falling.',
    },
    {
      title: 'Frontier is one opt-in line away',
      body: 'Start fully on open weights running locally. When a task needs a frontier model, add the provider as an opt-in adapter, never the default. The same permissions govern every action and the same audit log records it, whichever model runs.',
    },
  ],
  marketProof: {
    eyebrow: 'Why local-first matters',
    heading: 'Open and local models already run where data cannot leave.',
    body: 'Across regulated, high-stakes industries, teams already self-host open-weight models so sensitive data stays inside their boundary. RevealUI adds the governance layer on top: one permission model over people and agents, and a tamper-evident audit on every action.',
    adopters: [
      {
        name: 'HSBC',
        detail: 'is deploying self-hosted Mistral on its own internal systems in finance.',
        source: 'HSBC, 2025-12-01',
      },
      {
        name: 'Capital One',
        detail:
          'runs a production multi-agent assistant on fine-tuned Llama, with dealers reporting up to 55% more engagement.',
        source: 'Capital One tech blog, 2025-03-05',
      },
      {
        name: 'Goldman Sachs and Shopify',
        detail:
          'run Llama in production, with Shopify serving tens of millions of inferences a day.',
        source: 'Meta AI, 2024-08-29',
      },
      {
        name: 'Scale AI Defense Llama',
        detail: 'fine-tunes Llama 3 on doctrine and policy for controlled government environments.',
        source: 'Scale, 2024-11-04',
      },
    ] as readonly LocalAdopter[],
    disclaimer:
      'These are industry adopters of open and local models, not RevealUI customers. They show where the runtime fits: where good enough and yours beats best and rented.',
  },
  roadmap: {
    heading: 'On the roadmap',
    body: 'An air-gapped, container-image deployment path for fully disconnected environments. Not shipped yet, tracked on the roadmap.',
    href: '/roadmap',
  },
  honesty: LOCAL_AI_SECTION.honesty,
  cta: {
    primary: { label: 'Start building', href: SITE.urls.signup },
    secondary: { label: 'Read the docs', href: SITE.urls.docs },
  },
} as const;

// Provider-switch interactive (anchors the local-AI section). Toggling Local <->
// Frontier changes the model, the data locus, and the cost model, while the
// governance and audit row stays identical. The frontier-pathway made tangible.
// Honesty: the local LLM_PROVIDER value is grep-accurate; frontier is described
// as an opt-in adapter (the locked Pillar-2 framing), not a fabricated env value.
export const PROVIDER_SWITCH = {
  eyebrow: 'Local or frontier, same governance',
  heading: 'Switch the model. The rules do not move.',
  modes: {
    local: {
      label: 'Local',
      badge: 'default',
      model: 'gemma3, open-weight',
      locus: 'Runs on your own box',
      cost: 'Your inference cost, no per-token fee',
      config: 'LLM_PROVIDER=inference-snaps',
    },
    frontier: {
      label: 'Frontier',
      badge: 'opt-in',
      model: 'Claude, GPT, or Bedrock',
      locus: 'Calls the vendor API you choose',
      cost: 'Per-token vendor pricing',
      config: 'add a frontier adapter, one config line',
    },
  },
  attributes: [
    { key: 'model', label: 'Model' },
    { key: 'locus', label: 'Where it runs' },
    { key: 'cost', label: 'Cost model' },
    { key: 'config', label: 'Config' },
  ],
  constant: {
    label: 'Constant either way',
    items: [
      'The same RBAC + ABAC permissions',
      'The same tamper-evident audit log',
      'The same MCP tools',
    ],
  },
} as const;

// Frontier-pathway visual: open-weight default -> add adapter -> governed and
// audited, three steps, governance constant across all of them.
export interface FrontierStep {
  readonly n: string;
  readonly title: string;
  readonly body: string;
}

export const FRONTIER_PATHWAY = {
  eyebrow: 'The frontier pathway',
  heading: 'Start local. Escalate on purpose.',
  steps: [
    {
      n: '1',
      title: 'Open-weight default',
      body: 'Agents run on an open-weight model on your own box. Zero config.',
    },
    {
      n: '2',
      title: 'Add an adapter',
      body: 'When a task needs a frontier model, add the provider in one config line. Opt-in, never assumed.',
    },
    {
      n: '3',
      title: 'Governed and audited',
      body: 'Whichever model runs, the same permissions govern it and the same audit log records it.',
    },
  ] as readonly FrontierStep[],
  constant: 'Governance and audit stay identical across all three steps.',
} as const;
