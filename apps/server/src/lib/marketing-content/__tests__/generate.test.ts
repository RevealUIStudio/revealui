import {
  FLEET_MARKETING_VOICE_RULES,
  type MarketingBlock,
  type MarketingVoiceRules,
  type Tier3Report,
} from '@revealui/contracts/marketing-voice';
import { describe, expect, it } from 'vitest';
import { type ZodType, z } from 'zod/v4';
import {
  generateBlock,
  type LLMClient,
  type LLMMessage,
  parseAndValidate,
  validateMarketingBlock,
} from '../generate.js';

const blockSchema = z
  .object({ blockType: z.string() })
  .catchall(z.unknown()) as unknown as ZodType<MarketingBlock>;

function block(text: string, blockType = 'hero'): MarketingBlock {
  return {
    blockType,
    richText: {
      root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text }] }] },
    },
  };
}

const CLEAN = block('The self-hosted agentic business runtime.');
const RVC_PRICING = block('Buy RVC at $0.10 per token');
const HYPE = block('A revolutionary runtime');

/** A client that returns queued response strings in order. */
function fakeClient(responses: string[]): LLMClient {
  let i = 0;
  return {
    async chat(_messages: LLMMessage[]): Promise<{ content: string }> {
      const content = responses[Math.min(i, responses.length - 1)] ?? '';
      i++;
      return { content };
    },
  };
}

const deps = {
  blockSchema,
  voiceRules: FLEET_MARKETING_VOICE_RULES,
  renderSystemPrompt: () => 'system',
  renderUserPrompt: () => 'user',
};

describe('parseAndValidate', () => {
  it('returns null on malformed JSON', () => {
    expect(parseAndValidate('{ not json', blockSchema)).toBeNull();
  });

  it('returns null on well-formed but schema-invalid JSON', () => {
    expect(parseAndValidate(JSON.stringify({ notBlockType: 1 }), blockSchema)).toBeNull();
  });

  it('returns typed data on valid JSON', () => {
    const parsed = parseAndValidate(JSON.stringify(CLEAN), blockSchema);
    expect(parsed?.blockType).toBe('hero');
  });
});

describe('validateMarketingBlock', () => {
  it('reports tier1 + tier2 with tier3 null when no judge is injected', () => {
    const report = validateMarketingBlock(CLEAN, FLEET_MARKETING_VOICE_RULES);
    expect(report.tier1.passed).toBe(true);
    expect(report.tier2.passed).toBe(true);
    expect(report.tier3).toBeNull();
    expect(report.passed).toBe(true);
  });

  it('fails tier1 on an RVC pricing claim', () => {
    const report = validateMarketingBlock(RVC_PRICING, FLEET_MARKETING_VOICE_RULES);
    expect(report.tier1.passed).toBe(false);
    expect(report.passed).toBe(false);
  });

  it('runs the injected tier3 judge but keeps it out of `passed`', () => {
    const judge = (): Tier3Report => ({ scores: {}, findings: [], verdict: 'fail' });
    const report = validateMarketingBlock(CLEAN, FLEET_MARKETING_VOICE_RULES, { tier3: judge });
    expect(report.tier3?.verdict).toBe('fail');
    expect(report.passed).toBe(true); // tier3 advisory only
  });
});

describe('generateBlock', () => {
  it('returns ok on the first valid clean block', async () => {
    const result = await generateBlock(fakeClient([JSON.stringify(CLEAN)]), deps, 'go', {
      maxRetries: 3,
    });
    expect(result.outcome).toBe('ok');
    expect(result.attempts).toBe(1);
    expect(result.validation?.passed).toBe(true);
  });

  it('retries past a malformed-JSON response, then succeeds', async () => {
    const result = await generateBlock(
      fakeClient(['{ broken', JSON.stringify(CLEAN)]),
      deps,
      'go',
      {
        maxRetries: 3,
      },
    );
    expect(result.outcome).toBe('ok');
    expect(result.attempts).toBe(2);
  });

  it('returns tier1-blocked without retrying (structural, not regenerable)', async () => {
    const result = await generateBlock(fakeClient([JSON.stringify(RVC_PRICING)]), deps, 'go', {
      maxRetries: 3,
    });
    expect(result.outcome).toBe('tier1-blocked');
    expect(result.attempts).toBe(1);
    expect(result.validation?.tier1.passed).toBe(false);
  });

  it('re-prompts on a tier2 violation, then succeeds', async () => {
    const rules: MarketingVoiceRules = {
      tier1: FLEET_MARKETING_VOICE_RULES.tier1,
      tier2: [
        {
          kind: 'banned-tokens',
          ruleId: 't2.hype',
          tokens: ['revolutionary'],
          caseInsensitive: true,
        },
      ],
    };
    const result = await generateBlock(
      fakeClient([JSON.stringify(HYPE), JSON.stringify(CLEAN)]),
      { ...deps, voiceRules: rules },
      'go',
      { maxRetries: 3 },
    );
    expect(result.outcome).toBe('ok');
    expect(result.attempts).toBe(2);
  });

  it('returns exhausted (best attempt + violations) when every attempt fails tier2', async () => {
    const rules: MarketingVoiceRules = {
      tier1: FLEET_MARKETING_VOICE_RULES.tier1,
      tier2: [
        {
          kind: 'banned-tokens',
          ruleId: 't2.hype',
          tokens: ['revolutionary'],
          caseInsensitive: true,
        },
      ],
    };
    const result = await generateBlock(
      fakeClient([JSON.stringify(HYPE)]),
      { ...deps, voiceRules: rules },
      'go',
      {
        maxRetries: 2,
      },
    );
    expect(result.outcome).toBe('exhausted');
    expect(result.attempts).toBe(2);
    expect(result.validation?.tier2.passed).toBe(false);
  });
});
