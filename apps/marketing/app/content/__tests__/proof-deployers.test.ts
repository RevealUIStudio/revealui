import { describe, expect, it } from 'vitest';
import { PROOF_DEPLOYERS, PROOF_SECTION } from '../proof';
import { SITE } from '../site';

describe('PROOF_DEPLOYERS (FDE secondary band)', () => {
  it('keeps the open-source H2 identity separate from the deployers H3', () => {
    expect(PROOF_SECTION.heading).toBe('Read the code before you build on it.');
    expect(PROOF_DEPLOYERS.heading).toBe('Built for people who deploy, not only demo.');
    expect(PROOF_DEPLOYERS.heading).not.toEqual(PROOF_SECTION.heading);
  });

  it('is scenario-first and points at Studio, not a product rename', () => {
    expect(PROOF_DEPLOYERS.body).toMatch(/forward-deployed engineer/);
    expect(PROOF_DEPLOYERS.body).toMatch(/self-hosted runtime/);
    expect(PROOF_DEPLOYERS.body.toLowerCase()).not.toContain('fde platform');
    expect(PROOF_DEPLOYERS.cta.href).toBe(SITE.urls.agency);
  });

  it('contains no em dash', () => {
    const blob = [
      PROOF_DEPLOYERS.eyebrow,
      PROOF_DEPLOYERS.heading,
      PROOF_DEPLOYERS.body,
      PROOF_DEPLOYERS.foil,
      PROOF_DEPLOYERS.cta.label,
    ].join(' ');
    expect(blob).not.toContain('\u2014');
  });
});
