/**
 * OAuth provider unit tests (Stage 2 PR-2.1).
 *
 * Verifies the `Vault` contract, the revvault path layout, and the
 * `McpOAuthProvider`'s round-tripping of tokens, client info, and verifier
 * through a memory-backed vault. Hermetic — no network, no subprocess.
 */

import { describe, expect, it, vi } from 'vitest';
import { createMemoryVault, McpOAuthProvider, mcpOAuthPaths, type Vault } from '../src/oauth.js';

const TENANT = 'acme';
const SERVER = 'linear';

const baseClientMetadata = {
  redirect_uris: ['https://admin.example.com/oauth/callback'],
  client_name: 'Test Client',
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
  token_endpoint_auth_method: 'none',
};

function mkProvider(vault: Vault = createMemoryVault()): McpOAuthProvider {
  return new McpOAuthProvider({
    tenant: TENANT,
    server: SERVER,
    vault,
    redirectUrl: 'https://admin.example.com/oauth/callback',
    clientMetadata: baseClientMetadata,
  });
}

describe('mcpOAuthPaths', () => {
  it('produces the documented revvault layout', () => {
    expect(mcpOAuthPaths(TENANT, SERVER)).toEqual({
      tokens: 'mcp/acme/linear/tokens',
      client: 'mcp/acme/linear/client',
      verifier: 'mcp/acme/linear/verifier',
      discovery: 'mcp/acme/linear/discovery',
    });
  });
});

describe('createMemoryVault', () => {
  it('round-trips values', async () => {
    const vault = createMemoryVault();
    expect(await vault.get('foo/bar')).toBeUndefined();
    await vault.set('foo/bar', 'baz');
    expect(await vault.get('foo/bar')).toBe('baz');
    await vault.delete('foo/bar');
    expect(await vault.get('foo/bar')).toBeUndefined();
  });

  it('honors the seed map', async () => {
    const vault = createMemoryVault({ 'foo/bar': 'baz' });
    expect(await vault.get('foo/bar')).toBe('baz');
  });
});

describe('McpOAuthProvider', () => {
  it('exposes construction-time metadata via getters', () => {
    const provider = mkProvider();
    expect(provider.redirectUrl).toBe('https://admin.example.com/oauth/callback');
    expect(provider.clientMetadata).toEqual(baseClientMetadata);
  });

  it('state() returns a fresh UUID when no generator is configured', async () => {
    const provider = mkProvider();
    const a = await Promise.resolve(provider.state());
    const b = await Promise.resolve(provider.state());
    expect(typeof a).toBe('string');
    expect(a).not.toBe(b);
  });

  it('state() delegates to the configured generator', async () => {
    const vault = createMemoryVault();
    const provider = new McpOAuthProvider({
      tenant: TENANT,
      server: SERVER,
      vault,
      redirectUrl: 'https://admin.example.com/oauth/callback',
      clientMetadata: baseClientMetadata,
      state: () => 'fixed-state',
    });
    expect(await provider.state()).toBe('fixed-state');
  });

  it('tokens() returns undefined when nothing is stored', async () => {
    const provider = mkProvider();
    expect(await provider.tokens()).toBeUndefined();
  });

  it('round-trips OAuth tokens through the vault', async () => {
    const vault = createMemoryVault();
    const provider = mkProvider(vault);

    await provider.saveTokens({
      access_token: 'at-1',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'rt-1',
      scope: 'mcp:tools mcp:resources',
    });

    expect(await provider.tokens()).toEqual({
      access_token: 'at-1',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'rt-1',
      scope: 'mcp:tools mcp:resources',
    });

    // Tokens land at the documented path.
    const raw = await vault.get('mcp/acme/linear/tokens');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw as string).access_token).toBe('at-1');
  });

  it('persists rotated refresh tokens verbatim (OAuth 2.1 §4.12)', async () => {
    const provider = mkProvider();
    await provider.saveTokens({
      access_token: 'at-1',
      token_type: 'Bearer',
      refresh_token: 'rt-original',
    });
    await provider.saveTokens({
      access_token: 'at-2',
      token_type: 'Bearer',
      refresh_token: 'rt-rotated',
    });
    const stored = await provider.tokens();
    expect(stored?.access_token).toBe('at-2');
    expect(stored?.refresh_token).toBe('rt-rotated');
  });

  it('clientInformation() returns undefined before DCR', async () => {
    const provider = mkProvider();
    expect(await provider.clientInformation()).toBeUndefined();
  });

  it('round-trips DCR client information through the vault', async () => {
    const vault = createMemoryVault();
    const provider = mkProvider(vault);
    const registered = {
      client_id: 'client-xyz',
      client_secret: 'secret-123',
      client_id_issued_at: 1700000000,
      redirect_uris: ['https://admin.example.com/oauth/callback'],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_basic',
    };

    await provider.saveClientInformation(registered);

    expect(await provider.clientInformation()).toEqual(registered);
    expect(await vault.get('mcp/acme/linear/client')).toBeTruthy();
  });

  it('round-trips the PKCE code verifier through the vault', async () => {
    const vault = createMemoryVault();
    const provider = mkProvider(vault);
    await provider.saveCodeVerifier('abc123-verifier');
    expect(await provider.codeVerifier()).toBe('abc123-verifier');
    expect(await vault.get('mcp/acme/linear/verifier')).toBe('abc123-verifier');
  });

  it('codeVerifier() throws when the verifier is missing', async () => {
    const provider = mkProvider();
    await expect(provider.codeVerifier()).rejects.toThrow(/PKCE code verifier missing/);
  });

  it('redirectToAuthorization records the URL and invokes onRedirect', async () => {
    const vault = createMemoryVault();
    const onRedirect = vi.fn();
    const provider = new McpOAuthProvider({
      tenant: TENANT,
      server: SERVER,
      vault,
      redirectUrl: 'https://admin.example.com/oauth/callback',
      clientMetadata: baseClientMetadata,
      onRedirect,
    });

    const url = new URL('https://auth.example.com/authorize?client_id=abc&state=xyz');
    await provider.redirectToAuthorization(url);

    expect(provider.lastAuthorizationUrl?.toString()).toBe(url.toString());
    expect(onRedirect).toHaveBeenCalledOnce();
    expect(onRedirect).toHaveBeenCalledWith(url);
  });

  it('redirectToAuthorization works without an onRedirect hook', async () => {
    const provider = mkProvider();
    const url = new URL('https://auth.example.com/authorize?client_id=abc');
    await expect(provider.redirectToAuthorization(url)).resolves.toBeUndefined();
    expect(provider.lastAuthorizationUrl?.toString()).toBe(url.toString());
  });

  it('invalidateCredentials("all") deletes every path', async () => {
    const vault = createMemoryVault({
      'mcp/acme/linear/tokens': '{"access_token":"at"}',
      'mcp/acme/linear/client': '{"client_id":"cid"}',
      'mcp/acme/linear/verifier': 'ver',
      'mcp/acme/linear/discovery': '{}',
    });
    const provider = mkProvider(vault);
    await provider.invalidateCredentials('all');
    expect(await vault.get('mcp/acme/linear/tokens')).toBeUndefined();
    expect(await vault.get('mcp/acme/linear/client')).toBeUndefined();
    expect(await vault.get('mcp/acme/linear/verifier')).toBeUndefined();
    expect(await vault.get('mcp/acme/linear/discovery')).toBeUndefined();
  });

  it('invalidateCredentials("tokens") only deletes tokens', async () => {
    const vault = createMemoryVault({
      'mcp/acme/linear/tokens': '{"access_token":"at"}',
      'mcp/acme/linear/client': '{"client_id":"cid"}',
      'mcp/acme/linear/verifier': 'ver',
    });
    const provider = mkProvider(vault);
    await provider.invalidateCredentials('tokens');
    expect(await vault.get('mcp/acme/linear/tokens')).toBeUndefined();
    expect(await vault.get('mcp/acme/linear/client')).toBe('{"client_id":"cid"}');
    expect(await vault.get('mcp/acme/linear/verifier')).toBe('ver');
  });

  it('surfaces JSON parse errors on corrupted stored tokens', async () => {
    const vault = createMemoryVault({ 'mcp/acme/linear/tokens': 'not-json' });
    const provider = mkProvider(vault);
    await expect(provider.tokens()).rejects.toThrow(/Failed to parse stored tokens JSON/);
  });

  it('scopes state per (tenant, server) so two providers do not collide', async () => {
    const vault = createMemoryVault();
    const a = new McpOAuthProvider({
      tenant: 'acme',
      server: 'linear',
      vault,
      redirectUrl: 'https://admin.example.com/oauth/callback',
      clientMetadata: baseClientMetadata,
    });
    const b = new McpOAuthProvider({
      tenant: 'acme',
      server: 'notion',
      vault,
      redirectUrl: 'https://admin.example.com/oauth/callback',
      clientMetadata: baseClientMetadata,
    });
    await a.saveTokens({ access_token: 'linear-token', token_type: 'Bearer' });
    await b.saveTokens({ access_token: 'notion-token', token_type: 'Bearer' });
    expect((await a.tokens())?.access_token).toBe('linear-token');
    expect((await b.tokens())?.access_token).toBe('notion-token');
  });
});
