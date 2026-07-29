import { describe, expect, it } from 'vitest';
import {
  activeCopyDependentHolds,
  COPY_DEPENDENT_HOLDS,
  findCopyDependentHits,
} from '../copy-dependents.ts';

/** Minimal word tokenizer so this suite does not pull claim-drift-engine deps. */
function simpleTokens(line: string): { kind: string; text: string }[] {
  return line
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((text) => ({ kind: 'word', text }));
}

function hits(line: string) {
  return findCopyDependentHits(line, simpleTokens(line));
}

describe('copy-dependent holds', () => {
  it('registers waiting holds with stable COPY-DEP ids', () => {
    expect(COPY_DEPENDENT_HOLDS.length).toBeGreaterThan(0);
    for (const h of activeCopyDependentHolds()) {
      expect(h.id.startsWith('COPY-DEP-')).toBe(true);
      expect(h.status).toBe('waiting');
    }
  });

  it('uses line for empty/whitespace short-circuit (no underscore silence)', () => {
    expect(hits('')).toEqual([]);
    expect(hits('   \t  ')).toEqual([]);
  });

  it('flags marketplace live claims while hold is waiting', () => {
    const h = hits('The MCP marketplace is live for every operator.');
    expect(h.some((x) => x.holdId === 'COPY-DEP-MCP-MARKETPLACE')).toBe(true);
  });

  it('does not flag neutral marketplace glossary mentions', () => {
    const h = hits('The agent marketplace is a planned registry for MCP servers.');
    // "is a planned" — planned is not LIVE_STATUS
    expect(h.some((x) => x.holdId === 'COPY-DEP-MCP-MARKETPLACE')).toBe(false);
  });

  it('flags x402 live claims', () => {
    const h = hits('x402 is live on the production payments rail.');
    expect(h.some((x) => x.holdId === 'COPY-DEP-X402-LIVE')).toBe(true);
  });

  it('flags visual builder live claims', () => {
    const h = hits('Our visual builder is available for no-code site creation.');
    expect(h.some((x) => x.holdId === 'COPY-DEP-VISUAL-BUILDER')).toBe(true);
  });

  it('flags SSO live claims without flagging bare SSO', () => {
    expect(hits('Configure SSO for your team.').length).toBe(0);
    const h = hits('SSO is available on Enterprise today.');
    expect(h.some((x) => x.holdId === 'COPY-DEP-ENTERPRISE-SSO')).toBe(true);
  });

  it('flags GHCR fleet images live claims but not planned roadmap prose', () => {
    expect(
      hits(
        'Official Docker images published to GitHub Container Registry for fully self-hosted deployment.',
      ).some((x) => x.holdId === 'COPY-DEP-FLEET-DOCKER-IMAGES'),
    ).toBe(false);
    const h = hits('Official Docker images are available on GHCR today.');
    expect(h.some((x) => x.holdId === 'COPY-DEP-FLEET-DOCKER-IMAGES')).toBe(true);
  });
});
