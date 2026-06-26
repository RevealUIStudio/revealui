/**
 * Reasoner capabilities() — transport-tier conformance (P2 seed, ADR 2026-06-25).
 *
 * Asserts each provider's golden capability profile, the purity/stability invariant
 * (capabilities() is pure, deterministic, no network), and the cross-capability
 * consistency invariants. Fully offline — capabilities() makes no network calls.
 */

import { describe, expect, it } from 'vitest';
import type { Reasoner, ReasonerCapabilities } from '../base.js';
import { GroqProvider } from '../groq.js';
import { InferenceSnapsProvider } from '../inference-snaps.js';
import { OllamaProvider } from '../ollama.js';
import { OpenAICompatProvider } from '../openai-compat.js';

const TEST_URL = 'http://localhost:9999/v1';

const cases: Array<{ name: string; reasoner: Reasoner; expected: ReasonerCapabilities }> = [
  {
    name: 'openai-compat',
    reasoner: new OpenAICompatProvider({ apiKey: 'test', baseURL: TEST_URL }),
    expected: {
      providerTag: 'openai-compat',
      tools: true,
      parallelToolCalls: false,
      vision: false,
      streaming: true,
      embeddings: true,
      reasoningEffort: false,
      promptCache: false,
      structuredOutput: false,
    },
  },
  {
    name: 'inference-snaps',
    reasoner: new InferenceSnapsProvider({ baseURL: TEST_URL }),
    expected: {
      providerTag: 'inference-snaps',
      tools: true,
      parallelToolCalls: false,
      vision: false,
      streaming: true,
      embeddings: true,
      reasoningEffort: false,
      promptCache: false,
      structuredOutput: false,
    },
  },
  {
    name: 'ollama',
    reasoner: new OllamaProvider({}),
    expected: {
      providerTag: 'ollama',
      tools: true,
      parallelToolCalls: false,
      vision: false,
      streaming: true,
      embeddings: true,
      reasoningEffort: false,
      promptCache: false,
      structuredOutput: false,
    },
  },
  {
    name: 'groq',
    reasoner: new GroqProvider({ apiKey: 'test' }),
    expected: {
      providerTag: 'groq',
      tools: true,
      parallelToolCalls: false,
      vision: false,
      streaming: true,
      embeddings: false,
      reasoningEffort: false,
      promptCache: false,
      structuredOutput: false,
    },
  },
];

describe('Reasoner capabilities() — transport-tier conformance', () => {
  for (const { name, reasoner, expected } of cases) {
    describe(name, () => {
      it('matches its golden capability profile', () => {
        expect(reasoner.capabilities()).toEqual(expected);
      });

      it('is pure and stable (deterministic, no network)', () => {
        const first = reasoner.capabilities();
        for (let i = 0; i < 100; i++) {
          expect(reasoner.capabilities()).toEqual(first);
        }
      });

      it('satisfies the consistency invariants', () => {
        const caps = reasoner.capabilities();
        expect(caps.providerTag.length).toBeGreaterThan(0);
        // parallelToolCalls ⇒ tools
        if (caps.parallelToolCalls) {
          expect(caps.tools).toBe(true);
        }
        // contextWindow, when declared, is a positive integer
        if (caps.contextWindow !== undefined) {
          expect(Number.isInteger(caps.contextWindow)).toBe(true);
          expect(caps.contextWindow).toBeGreaterThan(0);
        }
      });
    });
  }
});
