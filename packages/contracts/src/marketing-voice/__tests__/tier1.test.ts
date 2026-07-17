import { describe, expect, it } from 'vitest';
import { runTier1 } from '../check-rule.js';
import type { ValidationResult } from '../rules.js';
import { FLEET_VOICE_RULES } from '../voice-rules.js';
import { code, contentBlock, heading, heroBlock, link, paragraph, prose, text } from './helpers.js';

function hasRule(result: ValidationResult, ruleId: string): boolean {
  return result.violations.some((v) => v.rule === ruleId);
}

const RVC = 'tier1.rvc-pricing-without-adr';

// Spec §5.5 fixture cases (a)–(g), rewritten to the REAL block shape
// (blockType + richText root), semantics preserved.
describe('runTier1 — RVC pricing claims must cite an ADR', () => {
  it('(a) blocks RVC near a $-amount in plain prose, attributing to the slot', () => {
    const block = heroBlock(heading('h1', 'Buy RVC at $0.10 per token'));
    const result = runTier1(block, FLEET_VOICE_RULES);
    const violation = result.violations.find((v) => v.rule === RVC);
    expect(violation).toBeDefined();
    expect(violation?.field).toBe('richText'); // real slot, not the spec's aspirational 'h1'
    expect(result.passed).toBe(false);
  });

  it('(b) blocks RVC near a percentage in plain prose', () => {
    const block = contentBlock(
      heading('h2', 'Vesting'),
      prose('RVC vesting unlocks 5% per quarter.'),
    );
    expect(hasRule(runTier1(block, FLEET_VOICE_RULES), RVC)).toBe(true);
  });

  it('(c) allows RVC near a $-amount inside a code node (structural exclusion)', () => {
    const block = contentBlock(heading('h2', 'API'), code('const price = "RVC at $0.001/token"'));
    expect(hasRule(runTier1(block, FLEET_VOICE_RULES), RVC)).toBe(false);
  });

  it('(d) blocks lowercase rvc near a percentage (token-lowercase comparison)', () => {
    const block = heroBlock(heading('h1', 'Stake'), prose('Earn 5% APY by staking rvc tokens'));
    expect(hasRule(runTier1(block, FLEET_VOICE_RULES), RVC)).toBe(true);
  });

  it('(e) allows RVC near a $-amount with a valid ADR-cite link in the same block', () => {
    const block = contentBlock(
      heading('h2', 'RVC pricing'),
      paragraph(
        text('RVC at $0.10 '),
        link('../docs/decisions/2026-05-12-rvc-pricing.md', 'per ADR'),
      ),
    );
    expect(hasRule(runTier1(block, FLEET_VOICE_RULES), RVC)).toBe(false);
  });

  it('(f) blocks RVC near a $-amount with a non-ADR link in the same block', () => {
    const block = contentBlock(
      heading('h2', 'RVC pricing'),
      paragraph(text('RVC at $0.10 '), link('../some-other-doc.md', 'foo')),
    );
    expect(hasRule(runTier1(block, FLEET_VOICE_RULES), RVC)).toBe(true);
  });

  it('(g) blocks when the ADR cite has invalid date semantics (month 13)', () => {
    const block = contentBlock(
      heading('h2', 'RVC pricing'),
      paragraph(text('RVC at $0.10 '), link('../docs/decisions/2026-13-99-bogus.md', 'foo')),
    );
    expect(hasRule(runTier1(block, FLEET_VOICE_RULES), RVC)).toBe(true);
  });
});

describe('runTier1 — h2-shape (rhetorical-question heading)', () => {
  const RULE = 'tier1.rhetorical-question-heading';

  it('blocks an interrogative heading ending in ?', () => {
    expect(
      hasRule(runTier1(heroBlock(heading('h2', 'Why RevealUI?')), FLEET_VOICE_RULES), RULE),
    ).toBe(true);
  });

  it('allows a declarative heading', () => {
    expect(
      hasRule(runTier1(heroBlock(heading('h2', 'How it works')), FLEET_VOICE_RULES), RULE),
    ).toBe(false);
  });

  it('does not fire on a body paragraph that starts with an interrogative', () => {
    expect(
      hasRule(runTier1(contentBlock(prose('Why does this matter?')), FLEET_VOICE_RULES), RULE),
    ).toBe(false);
  });
});

describe('runTier1 — fake-trust', () => {
  const RULE = 'tier1.fake-trust';

  it('blocks "Trusted by 400 teams" without an ADR', () => {
    expect(
      hasRule(runTier1(contentBlock(prose('Trusted by 400 teams')), FLEET_VOICE_RULES), RULE),
    ).toBe(true);
  });

  it('allows it with an ADR cite in the same block', () => {
    const block = contentBlock(
      paragraph(
        text('Trusted by 400 teams '),
        link('../docs/decisions/2026-05-12-trust.md', 'source'),
      ),
    );
    expect(hasRule(runTier1(block, FLEET_VOICE_RULES), RULE)).toBe(false);
  });
});

describe('runTier1 — pricing-proximity', () => {
  it('blocks "$5,000 per engagement" outside a pricing-tier source', () => {
    const result = runTier1(contentBlock(prose('$5,000 per engagement')), FLEET_VOICE_RULES);
    expect(hasRule(result, 'tier1.pricing-proximity')).toBe(true);
  });
});

describe('runTier1 — composition', () => {
  it('returns both violations across two prose containers', () => {
    const block = heroBlock(heading('h1', 'Buy RVC at $0.10'), prose('Trusted by 400 teams'));
    const result = runTier1(block, FLEET_VOICE_RULES);
    expect(hasRule(result, RVC)).toBe(true);
    expect(hasRule(result, 'tier1.fake-trust')).toBe(true);
    expect(result.passed).toBe(false);
  });

  it('passes a clean block with no violations', () => {
    const block = heroBlock(
      heading('h1', 'RevealUI'),
      prose('The self-hosted agentic business runtime.'),
    );
    const result = runTier1(block, FLEET_VOICE_RULES);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });
});
