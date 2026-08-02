/**
 * Pins every nudge's headline/body/CTA to the exact GAP-300 §7 wording.
 * Expected strings are hardcoded here (not re-derived from the module under
 * test) so a paraphrase or punctuation drift in definitions.ts fails loudly.
 */
import { describe, expect, it } from 'vitest';
import { NUDGE_DEFINITIONS, type NudgeId } from '../definitions.js';

const EXPECTED: Record<NudgeId, { headline: string; body: string; ctaLabel: string }> = {
  'free-first-reply': {
    headline: 'Your admin is running.',
    body: 'Ask the agent to do something and watch it answer. That first reply is the whole point of this screen.',
    ctaLabel: 'Talk to your agent',
  },
  'free-first-content': {
    headline: 'Put your agent to work on something real.',
    body: 'Create your first page and let the agent help you draft it.',
    ctaLabel: 'Create a page',
  },
  'free-pro-gate': {
    headline: 'You just found a Pro feature.',
    body: 'Pro agents act on your business and every action leaves a receipt you can check. Your free setup keeps working either way.',
    ctaLabel: 'See what Pro adds',
  },
  'pro-first-action': {
    headline: 'Your purchase is complete. Run your first agent task.',
    body: "Give an agent one real task and then open Task History. If an agent did it, there's a receipt.",
    ctaLabel: 'Run your first agent',
  },
  'pro-license-wire': {
    headline: 'Your license key is ready on your account page.',
    body: 'Wire it into your runtime so every surface you paid for unlocks.',
    ctaLabel: 'Get your license key',
  },
  'pro-read-receipts': {
    headline: 'Your agents have been busy.',
    body: 'Every action they took left a receipt. Read the trail once so you know what checking it feels like.',
    ctaLabel: 'Open the audit trail',
  },
  'pro-connect-data': {
    headline: 'Connect your agent to your real business data.',
    body: 'An agent that can read your content and your customers is the one that earns its keep.',
    ctaLabel: 'Connect a data source',
  },
  'max-enable-memory': {
    headline: 'Memory is included in Max and it is switched off.',
    body: 'Turn it on and your agents keep what they learn between tasks.',
    ctaLabel: 'Enable memory',
  },
  'max-local-inference': {
    headline: 'Run models on hardware you control.',
    body: 'Set up local inference and choose exactly which models your agents use.',
    ctaLabel: 'Set up inference',
  },
  'max-export-audit': {
    headline: 'Your audit log exports.',
    body: 'Try it once so you know the receipts are yours to keep, not just to read.',
    ctaLabel: 'Export the audit log',
  },
  'ent-second-tenant': {
    headline: 'Your first tenant is live.',
    body: 'Add your second site when you are ready, or bring it to your walkthrough call.',
    ctaLabel: 'Add a site',
  },
};

describe('NUDGE_DEFINITIONS — GAP-300 §7 string conformance', () => {
  it('holds all 11 nudge ids', () => {
    expect(Object.keys(NUDGE_DEFINITIONS).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  for (const id of Object.keys(EXPECTED) as NudgeId[]) {
    it(`${id} matches the exact §7 headline, body, and CTA`, () => {
      const definition = NUDGE_DEFINITIONS[id];
      const expected = EXPECTED[id];
      expect(definition.headline).toBe(expected.headline);
      expect(definition.body).toBe(expected.body);
      expect(definition.ctaLabel).toBe(expected.ctaLabel);
    });
  }

  it('contains no em dash character in any nudge string', () => {
    const emDash = String.fromCharCode(0x2014);
    for (const definition of Object.values(NUDGE_DEFINITIONS)) {
      expect(definition.headline.includes(emDash)).toBe(false);
      expect(definition.body.includes(emDash)).toBe(false);
      expect(definition.ctaLabel.includes(emDash)).toBe(false);
    }
  });

  it('mentions neither SSO nor white-label anywhere (honesty guardrail)', () => {
    for (const definition of Object.values(NUDGE_DEFINITIONS)) {
      const text = `${definition.headline} ${definition.body} ${definition.ctaLabel}`.toLowerCase();
      expect(text.includes('sso')).toBe(false);
      expect(text.includes('white-label')).toBe(false);
      expect(text.includes('white label')).toBe(false);
    }
  });
});
