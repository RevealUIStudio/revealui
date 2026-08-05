/**
 * GAP-464 Phase 7 — mock IdP integration + security regression.
 * Pure-layer end-to-end against real crypto (no HTTP route mocks).
 */

import { generateKeyPairSync } from 'node:crypto';
import { importPKCS8, SignJWT } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  buildOidcAuthorizationUrl,
  exchangeOidcCode,
  fetchOidcDiscovery,
  validateOidcIdToken,
} from '../oidc.js';
import { mapSsoGroupsToRole } from '../roles.js';
import {
  buildSamlAuthorizeUrl,
  parseIdpMetadataXml,
  type SamlSpConfig,
  validateSamlPostResponse,
} from '../saml.js';
import { generateSsoState, verifySsoState } from '../state.js';
import { createMockOidcIdp, type MockOidcIdp } from './helpers/mock-oidc-idp.js';
import { createMockSamlIdp, type MockSamlIdp } from './helpers/mock-saml-idp.js';

const SP_ENTITY = 'https://app.example.com/sp';
const ACS = 'https://api.example.com/api/auth/sso/prov-1/callback';

describe('mock OIDC IdP integration (GAP-464 Phase 7)', () => {
  let idp: MockOidcIdp;

  beforeAll(async () => {
    process.env.REVEALUI_SECRET = 'mock-idp-integration-secret-for-tests-only';
    idp = await createMockOidcIdp();
  });

  it('walks discovery → token exchange → id_token validate → group map', async () => {
    const discovery = await fetchOidcDiscovery(idp.discoveryUrl, {
      fetchImpl: idp.fetchImpl,
      expectedIssuer: idp.issuer,
    });
    expect(discovery.ok).toBe(true);
    if (!discovery.ok) return;

    const state = generateSsoState({
      accountId: 'acct-1',
      providerId: 'prov-1',
      redirectTo: '/home',
    });
    // codeVerifier lives inside signed state (unpacked on ACS); not on GenerateSsoStateResult
    const verified = verifySsoState(state.state, state.cookieValue);
    expect(verified).not.toBeNull();
    if (!verified) return;

    const authUrl = buildOidcAuthorizationUrl({
      authorizationEndpoint: discovery.document.authorization_endpoint,
      clientId: idp.clientId,
      redirectUri: ACS,
      state: state.state,
      codeChallenge: state.codeChallenge,
    });
    expect(authUrl.startsWith(idp.authorizationEndpoint)).toBe(true);
    expect(authUrl.includes('code_challenge_method=S256')).toBe(true);

    const exchange = await exchangeOidcCode({
      tokenEndpoint: discovery.document.token_endpoint,
      clientId: idp.clientId,
      clientSecret: idp.clientSecret,
      code: 'mock-auth-code',
      redirectUri: ACS,
      codeVerifier: verified.codeVerifier,
      fetchImpl: idp.fetchImpl,
    });
    if (!exchange.ok) {
      throw new Error(`token exchange failed: ${exchange.reason} ${exchange.message}`);
    }

    const validated = await validateOidcIdToken({
      idToken: exchange.tokens.id_token,
      issuer: idp.issuer,
      clientId: idp.clientId,
      jwks: idp.publicKey,
    });
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    expect(validated.claims.email).toBe('alice@example.com');
    expect(validated.claims.sub).toBe('user-sub-1');

    const roles = mapSsoGroupsToRole({
      claims: validated.claims.payload as Record<string, unknown>,
      groupClaim: 'groups',
      groupRoleMap: { Engineering: 'member', Staff: 'editor' },
      defaultRole: 'viewer',
      requireGroupMatch: false,
    });
    expect(roles.ok).toBe(true);
    if (roles.ok) {
      // highest of member + editor = editor
      expect(roles.role).toBe('editor');
      expect(roles.matchedGroups).toContain('Engineering');
    }
  });

  it('rejects id_token with wrong issuer (security regression)', async () => {
    const token = await idp.signIdToken({ sub: 'u1' }, { issuer: 'https://evil.example.com' });
    const result = await validateOidcIdToken({
      idToken: token,
      issuer: idp.issuer,
      clientId: idp.clientId,
      jwks: idp.publicKey,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_issuer');
  });

  it('rejects id_token with wrong audience', async () => {
    const token = await idp.signIdToken({ sub: 'u1' }, { audience: 'other-client' });
    const result = await validateOidcIdToken({
      idToken: token,
      issuer: idp.issuer,
      clientId: idp.clientId,
      jwks: idp.publicKey,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_audience');
  });

  it('rejects expired id_token', async () => {
    const past = Math.floor(Date.now() / 1000) - 120;
    const token = await idp.signIdToken({ sub: 'u1' }, { expSeconds: past });
    const result = await validateOidcIdToken({
      idToken: token,
      issuer: idp.issuer,
      clientId: idp.clientId,
      jwks: idp.publicKey,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('expired');
  });

  it('rejects id_token signed by a different key', async () => {
    const { privateKey: evilPem } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const evilKey = await importPKCS8(evilPem, 'RS256');
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ sub: 'u1' })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(idp.issuer)
      .setAudience(idp.clientId)
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .setSubject('u1')
      .sign(evilKey);

    const result = await validateOidcIdToken({
      idToken: token,
      issuer: idp.issuer,
      clientId: idp.clientId,
      jwks: idp.publicKey,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_signature');
  });

  it('rejects require_group_match when no groups map', async () => {
    const token = await idp.signIdToken({ sub: 'u1', groups: ['Unknown'] });
    const validated = await validateOidcIdToken({
      idToken: token,
      issuer: idp.issuer,
      clientId: idp.clientId,
      jwks: idp.publicKey,
    });
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;

    const roles = mapSsoGroupsToRole({
      claims: validated.claims.payload as Record<string, unknown>,
      groupClaim: 'groups',
      groupRoleMap: { Engineering: 'member' },
      defaultRole: 'viewer',
      requireGroupMatch: true,
    });
    expect(roles.ok).toBe(false);
    if (!roles.ok) expect(roles.reason).toBe('require_group_match');
  });
});

describe('mock SAML IdP integration (GAP-464 Phase 7)', () => {
  let idp: MockSamlIdp;
  let spConfig: SamlSpConfig;

  beforeAll(() => {
    idp = createMockSamlIdp();
    const meta = parseIdpMetadataXml(idp.metadataXml);
    expect(meta.ok).toBe(true);
    if (!meta.ok) throw new Error('mock IdP metadata must parse');

    spConfig = {
      spEntityId: SP_ENTITY,
      callbackUrl: ACS,
      entryPoint: meta.entryPoint,
      idpCertPem: meta.idpCertPem,
    };
  });

  it('parses IdP metadata and builds SP-initiated AuthnRequest redirect', async () => {
    expect(spConfig.entryPoint).toBe(idp.ssoUrl);
    const auth = await buildSamlAuthorizeUrl(spConfig, 'relay-state-token');
    expect(auth.ok).toBe(true);
    if (auth.ok) {
      expect(auth.url.startsWith(idp.ssoUrl)).toBe(true);
      expect(auth.url.includes('SAMLRequest=')).toBe(true);
      expect(auth.url.includes('RelayState=')).toBe(true);
    }
  });

  it('accepts a signed SAMLResponse from the mock IdP (happy path)', async () => {
    const samlResponse = idp.buildPostResponse({
      spEntityId: SP_ENTITY,
      acsUrl: ACS,
      nameId: 'bob@example.com',
      groups: ['Engineering'],
      sign: true,
    });

    const result = await validateSamlPostResponse(spConfig, samlResponse);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      // surface reason for debugging if mock signature layout needs tweak
      throw new Error(`SAML validate failed: ${result.reason} ${result.message}`);
    }
    expect(result.assertion.subject).toBe('bob@example.com');
    expect(
      result.assertion.email === 'bob@example.com' || result.assertion.subject.includes('@'),
    ).toBe(true);

    const roles = mapSsoGroupsToRole({
      claims: result.assertion.attributes,
      groupClaim: 'groups',
      groupRoleMap: { Engineering: 'member' },
      defaultRole: 'viewer',
      requireGroupMatch: false,
    });
    expect(roles.ok).toBe(true);
    if (roles.ok) expect(roles.role).toBe('member');
  });

  it('rejects unsigned SAMLResponse (signature hardline)', async () => {
    const samlResponse = idp.buildPostResponse({
      spEntityId: SP_ENTITY,
      acsUrl: ACS,
      nameId: 'bob@example.com',
      sign: false,
    });
    const result = await validateSamlPostResponse(spConfig, samlResponse);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason === 'invalid_signature' || result.reason === 'validation_failed').toBe(
        true,
      );
    }
  });

  it('rejects SAMLResponse when SP is configured with the wrong IdP cert', async () => {
    const other = createMockSamlIdp({ entityId: 'https://other-idp.example.com' });
    const samlResponse = idp.buildPostResponse({
      spEntityId: SP_ENTITY,
      acsUrl: ACS,
      nameId: 'bob@example.com',
      sign: true,
    });
    const wrongConfig: SamlSpConfig = {
      ...spConfig,
      idpCertPem: other.certPem,
    };
    const result = await validateSamlPostResponse(wrongConfig, samlResponse);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason === 'invalid_signature' || result.reason === 'validation_failed').toBe(
        true,
      );
    }
  });

  it('rejects expired assertion (NotOnOrAfter in the past)', async () => {
    const samlResponse = idp.buildPostResponse({
      spEntityId: SP_ENTITY,
      acsUrl: ACS,
      nameId: 'bob@example.com',
      sign: true,
      // beyond acceptedClockSkewMs (5m) so node-saml rejects NotOnOrAfter
      notOnOrAfterOffsetMs: -15 * 60 * 1000,
    });
    const result = await validateSamlPostResponse(spConfig, samlResponse);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.reason === 'expired' ||
          result.reason === 'validation_failed' ||
          result.reason === 'invalid_signature',
      ).toBe(true);
    }
  });
});
