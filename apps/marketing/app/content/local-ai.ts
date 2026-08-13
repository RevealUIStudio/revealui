// Content for the standalone /local-ai page (LocalAiPage.tsx). The former
// home-section wrapper (LocalAi.tsx) was removed in frontend-excellence
// Phase 1 (11->7 section cut): its strongest single beat already lives in
// Proof (PROOF_LOCAL_AI, content/proof.ts), and the interactive
// ProviderSwitch/FrontierPathway + one-config-line snippet live on this page.
// LOCAL_AI_SECTION.eyebrow/heading/body/beats/cta are retained as documented
// corpus content (shared with LOCAL_AI_PAGE.honesty below) even though the
// homepage no longer renders them directly.
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
// (LLM_PROVIDER; inference-snaps default gemma3 :9090, ollama qwen2.5:3b :11434).
// Positioning guardrail (Phase C): ownership stays the lead; local AI is its proof.
//
// claims-ratchet 2026-07-12: frontier-mode provider naming scoped to the shipped
// adapters (openai-compat, groq, ollama, huggingface). The prior Claude/Bedrock
// naming was removed because no Claude or Bedrock adapter ships in packages/ai.

import { SITE } from './site';

export interface LocalAiBeat {
  readonly title: string;
  readonly body: string;
}

// Shared home-section content. Four beats per the corpus §4.12 lead.
export const LOCAL_AI_SECTION = {
  eyebrow: 'Local-first AI',
  heading: 'Your agents run on models you own.',
  body: 'By default, agents run on open-weight models on infrastructure you control. Their work stays in your boundary. Your AI bill is your own inference cost.',
  beats: [
    {
      title: 'Sovereignty',
      body: 'In the default config, inference runs where you host it. Content agents read and write does not leave your boundary for a hosted model API.',
    },
    {
      title: 'Economics',
      body: 'You pay for your own inference and compute, not a per-token tax that scales with usage.',
    },
    {
      title: 'Pathway',
      body: 'When you want a frontier model, add it in one config line: opt-in, never assumed.',
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
      { code: 'LLM_PROVIDER=ollama', note: 'qwen2.5:3b on your box, port 11434' },
    ],
  },
  dogfood:
    'RevDev Studio, the harness this team uses to build RevealUI, includes a local-inference cockpit for Inference Snaps and Ollama. The maintainers run local inference themselves.',
  honesty:
    'Local inference needs an open-weight model runner (Ollama or Ubuntu Inference Snaps) and enough hardware. Frontier models still lead the hardest work, which is why they stay one config line away.',
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
  lead: 'RevealUI is open-model first. The runtime does not require a hosted model API. Open-weight models are the default. A frontier provider is one opt-in config line, not the default. Ownership leads. Local AI is how you prove it.',
  pillars: [
    {
      title: 'Your data stays in your boundary',
      body: 'In the default config, agents run on an open-weight model you host. No hosted model API sits between your code and your business data.',
    },
    {
      title: 'Your inference cost, not a per-token tax',
      body: 'You pay for your own inference and compute, not a per-token fee that scales with usage. Frontier API prices have moved up; local and commodity inference keep falling.',
    },
    {
      title: 'Frontier is one opt-in line away',
      body: 'Start on open weights running locally. When a task needs a frontier model, add the provider as an opt-in adapter, not as the default.',
    },
  ],
  // Named third-party adopters removed (2026-08-01 marketing corpus audit):
  // they are not RevealUI customers and burn trust after a long disclaimer.
  // Keep one industry-pattern card; re-add named rows only with fresh citations
  // and an explicit "not our customers" line on the card itself.
  marketProof: {
    eyebrow: 'Why local-first matters',
    heading: 'Open and local models already run where data cannot leave.',
    body: 'In regulated and high-stakes work, teams already self-host open-weight models so sensitive data stays inside their boundary. That is where RevealUI fits: good enough and yours beats best and rented.',
    adopters: [
      {
        name: 'Industry pattern',
        detail:
          'Finance, defense, and other regulated teams already run open-weight models on infrastructure they control when sensitive data must stay inside their boundary.',
        source: 'Market pattern, not RevealUI customers',
      },
    ] as readonly LocalAdopter[],
    disclaimer:
      'This is an industry pattern, not a RevealUI customer list. Use it to place the runtime, not as social proof of our install base.',
  },
  roadmap: {
    heading: 'On the roadmap',
    body: 'An air-gapped, container-image path for fully disconnected environments. Not shipped yet. Tracked on the roadmap.',
    href: '/roadmap',
  },
  honesty: LOCAL_AI_SECTION.honesty,
  cta: {
    primary: { label: 'Start building', href: SITE.urls.signup },
    secondary: { label: 'Read the docs', href: SITE.urls.docs },
  },
} as const;

// Provider-switch interactive (anchors the local-AI section). Toggling Local <->
// Frontier changes the model, the data locus, and the cost model. The
// frontier-pathway made tangible.
// Honesty: the local LLM_PROVIDER value is grep-accurate; frontier is described
// as an opt-in adapter (the locked Pillar-2 framing), not a fabricated env value.
export const PROVIDER_SWITCH = {
  eyebrow: 'Local or frontier',
  heading: 'Switch the model.',
  modes: {
    local: {
      label: 'Local',
      badge: 'default',
      model: 'gemma3, open-weight (US-origin)',
      locus: 'Runs on your own box',
      cost: 'Your inference cost, no per-token fee',
      config: 'LLM_PROVIDER=inference-snaps',
    },
    frontier: {
      label: 'Frontier',
      badge: 'opt-in',
      model: 'GPT or any OpenAI-compatible provider',
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
    items: ['The same MCP tools'],
  },
} as const;

// Frontier-pathway visual: open-weight default -> add adapter, two steps.
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
      body: 'Agents run on an open-weight model on your machine. No hosted provider required to start.',
    },
    {
      n: '2',
      title: 'Add an adapter',
      body: 'When a task needs a frontier model, add the provider in one config line. Opt-in, never assumed.',
    },
  ] as readonly FrontierStep[],
} as const;
