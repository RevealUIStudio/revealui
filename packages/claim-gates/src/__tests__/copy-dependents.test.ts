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

  it('keeps Enterprise SSO/SAML holds waiting until #449 closes', () => {
    const sso = COPY_DEPENDENT_HOLDS.find((h) => h.id === 'COPY-DEP-ENTERPRISE-SSO');
    const saml = COPY_DEPENDENT_HOLDS.find((h) => h.id === 'COPY-DEP-ENTERPRISE-SAML');
    expect(sso?.status).toBe('waiting');
    expect(saml?.status).toBe('waiting');
    expect(sso?.publicTracker).toBe('#449');
    expect(saml?.publicTracker).toBe('#449');
  });

  it('flags SSO live claims without flagging bare SSO', () => {
    expect(hits('Configure SSO for your team.').length).toBe(0);
    const h = hits('SSO is available on Enterprise today.');
    expect(h.some((x) => x.holdId === 'COPY-DEP-ENTERPRISE-SSO')).toBe(true);
  });

  it('flags present-tense SSO/SAML in-code claims unless the line is qualified', () => {
    expect(
      hits('SSO is in code for every Enterprise account.').some(
        (x) => x.holdId === 'COPY-DEP-ENTERPRISE-SSO',
      ),
    ).toBe(true);
    expect(
      hits('SAML is in code on the Enterprise tier.').some(
        (x) => x.holdId === 'COPY-DEP-ENTERPRISE-SAML',
      ),
    ).toBe(true);
    expect(
      hits('SSO (OIDC + SAML in code) and domain-locked').some(
        (x) => x.holdId === 'COPY-DEP-ENTERPRISE-SSO' || x.holdId === 'COPY-DEP-ENTERPRISE-SAML',
      ),
    ).toBe(true);
    expect(hits('SSO is in code — #449').some((x) => x.holdId === 'COPY-DEP-ENTERPRISE-SSO')).toBe(
      true,
    );

    expect(
      hits('SSO (operator preview, not customer-walked — #449)').some(
        (x) => x.holdId === 'COPY-DEP-ENTERPRISE-SSO',
      ),
    ).toBe(false);
    expect(
      hits('SAML (planned, operator preview — #449)').some(
        (x) => x.holdId === 'COPY-DEP-ENTERPRISE-SAML',
      ),
    ).toBe(false);
  });

  it('flags unqualified pricing what-you-get SSO rows', () => {
    const row = '| **Enterprise** | $1,499/mo | SSO, domain-locked |';
    expect(hits(row).some((x) => x.holdId === 'COPY-DEP-ENTERPRISE-SSO')).toBe(true);
    const qualified =
      '| **Enterprise** | $1,499/mo | SSO (operator preview, not customer-walked — #449), domain-locked |';
    expect(hits(qualified).some((x) => x.holdId === 'COPY-DEP-ENTERPRISE-SSO')).toBe(false);
  });

  it('does not flag honest residual or operator SSO/SAML lines', () => {
    expect(
      hits(
        'Enterprise SSO (OIDC + SAML SP-initiated) is in code. SCIM is not built and this does not work yet.',
      ).some(
        (x) => x.holdId === 'COPY-DEP-ENTERPRISE-SSO' || x.holdId === 'COPY-DEP-ENTERPRISE-SAML',
      ),
    ).toBe(false);
    expect(
      hits(
        'Enterprise accounts with the sso feature gate can attach an OIDC or SAML identity provider.',
      ).some(
        (x) => x.holdId === 'COPY-DEP-ENTERPRISE-SSO' || x.holdId === 'COPY-DEP-ENTERPRISE-SAML',
      ),
    ).toBe(false);
    expect(
      hits('| SAML pure | packages/auth/src/server/sso/saml.ts |').some(
        (x) => x.holdId === 'COPY-DEP-ENTERPRISE-SAML',
      ),
    ).toBe(false);
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

  it('flags C-SCRM and NIST 800-161 certification claims', () => {
    expect(
      hits('C-SCRM is certified for every tenant.').some(
        (x) => x.holdId === 'COPY-DEP-C-SCRM-CERT',
      ),
    ).toBe(true);
    expect(
      hits('RevealUI is NIST 800-161 compliant today.').some(
        (x) => x.holdId === 'COPY-DEP-C-SCRM-CERT',
      ),
    ).toBe(true);
    expect(
      hits('Supply chain risk is a buyer concern.').some(
        (x) => x.holdId === 'COPY-DEP-C-SCRM-CERT',
      ),
    ).toBe(false);
  });

  it('flags trustworthy-AI badges but not a bare NIST attribute mention', () => {
    expect(
      hits('Our trustworthy AI is certified for operators.').some(
        (x) => x.holdId === 'COPY-DEP-TRUSTWORTHY-AI',
      ),
    ).toBe(true);
    expect(
      hits('Fairness is one trustworthy AI attribute.').some(
        (x) => x.holdId === 'COPY-DEP-TRUSTWORTHY-AI',
      ),
    ).toBe(false);
  });

  it('flags AML-hardened and weight-scan claims', () => {
    expect(
      hits('The runtime is adversarially robust.').some(
        (x) => x.holdId === 'COPY-DEP-AML-HARDENED',
      ),
    ).toBe(true);
    expect(
      hits('We scan model weights before load.').some(
        (x) => x.holdId === 'COPY-DEP-MODEL-PROVENANCE',
      ),
    ).toBe(true);
    expect(
      hits('Hash plus URL is provenance, not a scan.').some(
        (x) => x.holdId === 'COPY-DEP-MODEL-PROVENANCE',
      ),
    ).toBe(false);
  });
});
