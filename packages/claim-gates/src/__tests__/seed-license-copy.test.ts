import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { countLicenseSplit } from '../claim-drift/license.ts';
import { configureClaimGatesRoot } from '../claim-drift/state.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

/**
 * The admin seed home page is the first copy a new install shows, and it is
 * outside claim-drift's marketing/docs scan roots. Pin the license sentence
 * to each package.json license field so "20 of 26" cannot come back.
 */
describe('seeded home license copy', () => {
  it('states the measured MIT, Fair Source, and internal split', () => {
    configureClaimGatesRoot(root);
    const split = countLicenseSplit();
    const total = split.mit + split.fsl + split.internal;
    const seed = readFileSync(path.join(root, 'apps/admin/src/seed.ts'), 'utf8');
    const sentence = `${split.mit} of the ${total} packages are MIT, forever. The ${split.fsl} Pro packages are Fair Source (FSL-1.1-MIT) and convert to MIT two years after each release. The remaining ${split.internal} workspace packages are internal tooling with no public license.`;

    expect(seed).toContain(sentence);
    expect(seed).toContain('Auth, billing, content, and agents: wired, audited, yours.');
    expect(seed).toContain(
      'The 5 Pro packages (ai, engines, harnesses, mcp, and services) are Fair Source (FSL-1.1-MIT): source-visible, commercially usable except as a competing developer platform, and each release converts to MIT two years after it ships.',
    );
    expect(seed).not.toContain('20 of 26');
    expect(seed).not.toContain('agents - wired');
    expect(seed).not.toContain('commercially licensed for platforms');
  });
});
