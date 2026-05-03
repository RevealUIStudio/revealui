/**
 * Unit tests for `scripts/emit-from-mcp.ts` (F8 Phase 3 Stage 1).
 *
 * Imports the script's exported pure functions (`buildContractsOpenApi`,
 * `serializeContractsOpenApi`) — does NOT exercise the CLI entry point.
 * The CLI is exercised by the `pnpm check:contracts` CI gate.
 */

import { describe, expect, it } from 'vitest';
import { buildContractsOpenApi, serializeContractsOpenApi } from '../../scripts/emit-from-mcp.js';

describe('emit-from-mcp / buildContractsOpenApi', () => {
  it('returns OpenAPI 3.1.0 spec', () => {
    const spec = buildContractsOpenApi();
    expect(spec.openapi).toBe('3.1.0');
  });

  it('declares JSON Schema 2020-12 dialect at root', () => {
    const spec = buildContractsOpenApi();
    expect(spec.jsonSchemaDialect).toBe('https://json-schema.org/draft/2020-12/schema');
  });

  it('has info block with stable title', () => {
    const spec = buildContractsOpenApi();
    expect(spec.info.title).toBe('RevealUI Contracts (Types Mirror)');
  });

  it('pins info.version to @revealui/contracts package.json version (semver-shaped)', () => {
    const spec = buildContractsOpenApi();
    expect(spec.info.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('declares MIT license', () => {
    const spec = buildContractsOpenApi();
    expect(spec.info.license.name).toBe('MIT');
    expect(spec.info.license.identifier).toBe('MIT');
  });

  it('mentions the protocol-pyramid ADR in the description', () => {
    const spec = buildContractsOpenApi();
    expect(spec.info.description).toContain('protocol-pyramid');
  });

  it('exposes >= 17 components (one per category, at least)', () => {
    const spec = buildContractsOpenApi();
    const componentCount = Object.keys(spec.components.schemas).length;
    expect(componentCount).toBeGreaterThanOrEqual(17);
  });

  it('component names use snake_case category + camelCase schemaName joined by underscore', () => {
    const spec = buildContractsOpenApi();
    for (const name of Object.keys(spec.components.schemas)) {
      // <snake_case category>_<camelCase or snake_case schema name>.
      // Categories are always lowercase + underscores (e.g. `api_auth`,
      // `stripe_webhook_events`); schema names are camelCase
      // (e.g. `agentCard`, `signIn`) or lowercase (e.g. `block`, `user`).
      // The whole component name must start lowercase and contain at
      // least one underscore between category and schema-name segments.
      expect(name).toMatch(/^[a-z][a-zA-Z0-9_]*$/);
      expect(name.split('_').length).toBeGreaterThanOrEqual(2);
    }
  });

  it('includes the canonical primary schema for every category', () => {
    const spec = buildContractsOpenApi();
    const expectedPrimaries = [
      'a2a_agentCard',
      'admin_collection',
      'agents_agentMemory',
      'api_auth_signIn',
      'api_chat_chatRequest',
      'api_gdpr_gdprExport',
      'content_block',
      'content_validation_config',
      'devkit_profiles_profileId',
      'entities_user',
      'generated_usersInsert',
      'providers_providerId',
      'representation_dualEntity',
      'revealcoin_tokenConfig',
      'secrets_secretActor',
      'security_securityRule',
      'stripe_webhook_events_eventType',
    ];
    for (const expected of expectedPrimaries) {
      expect(spec.components.schemas).toHaveProperty(expected);
    }
  });

  it('strips $schema keyword from each component (OpenAPI 3.1 root-dialect convention)', () => {
    const spec = buildContractsOpenApi();
    for (const [name, schema] of Object.entries(spec.components.schemas)) {
      expect(schema, `component ${name} should not have $schema key`).not.toHaveProperty('$schema');
    }
  });

  it('every component is a non-empty object (catalog completeness)', () => {
    const spec = buildContractsOpenApi();
    for (const [name, schema] of Object.entries(spec.components.schemas)) {
      expect(typeof schema, `${name} should be an object`).toBe('object');
      expect(schema, `${name} should not be null`).not.toBeNull();
      const keys = Object.keys(schema as Record<string, unknown>);
      expect(keys.length, `${name} should have >= 1 schema field`).toBeGreaterThan(0);
    }
  });

  it('emits component schemas in alphabetical key order (deterministic output)', () => {
    const spec = buildContractsOpenApi();
    const keys = Object.keys(spec.components.schemas);
    const sorted = [...keys].sort();
    expect(keys).toEqual(sorted);
  });

  it('is deterministic across calls (drift-detection-safe)', () => {
    const a = serializeContractsOpenApi(buildContractsOpenApi());
    const b = serializeContractsOpenApi(buildContractsOpenApi());
    expect(a).toBe(b);
  });
});

describe('emit-from-mcp / serializeContractsOpenApi', () => {
  it('produces parseable JSON', () => {
    const spec = buildContractsOpenApi();
    const serialized = serializeContractsOpenApi(spec);
    expect(() => JSON.parse(serialized)).not.toThrow();
  });

  it('round-trips losslessly', () => {
    const spec = buildContractsOpenApi();
    const serialized = serializeContractsOpenApi(spec);
    const reparsed = JSON.parse(serialized);
    expect(reparsed).toEqual(spec);
  });

  it('terminates with a newline (POSIX + git-diff convention)', () => {
    const spec = buildContractsOpenApi();
    const serialized = serializeContractsOpenApi(spec);
    expect(serialized.endsWith('\n')).toBe(true);
  });

  it('uses 2-space indentation (matches repo Biome config)', () => {
    const spec = buildContractsOpenApi();
    const serialized = serializeContractsOpenApi(spec);
    // First nested key is at 2-space indent.
    expect(serialized).toMatch(/\n {2}"openapi"/);
  });
});

describe('emit-from-mcp / regression: PR #731 contracts schemas surface', () => {
  // These tests pin the contracts categories shipped in PR #731 — if a
  // contracts category is removed in a future minor of @revealui/mcp,
  // this gate catches the resulting OpenAPI mirror gap before drift
  // detection in CI.

  it('a2a category surfaces full A2A protocol schemas', () => {
    const spec = buildContractsOpenApi();
    expect(spec.components.schemas).toHaveProperty('a2a_agentCard');
    expect(spec.components.schemas).toHaveProperty('a2a_task');
    expect(spec.components.schemas).toHaveProperty('a2a_message');
    expect(spec.components.schemas).toHaveProperty('a2a_skill');
  });

  it('agents category surfaces LLM agent behavior schemas', () => {
    const spec = buildContractsOpenApi();
    expect(spec.components.schemas).toHaveProperty('agents_agentMemory');
    expect(spec.components.schemas).toHaveProperty('agents_conversationMessage');
    expect(spec.components.schemas).toHaveProperty('agents_toolDefinition');
  });

  it('api_auth category surfaces full auth surface', () => {
    const spec = buildContractsOpenApi();
    expect(spec.components.schemas).toHaveProperty('api_auth_signIn');
    expect(spec.components.schemas).toHaveProperty('api_auth_signUp');
    expect(spec.components.schemas).toHaveProperty('api_auth_mfaSetupResponse');
  });

  it('content category surfaces block discriminated union variants', () => {
    const spec = buildContractsOpenApi();
    expect(spec.components.schemas).toHaveProperty('content_block');
    expect(spec.components.schemas).toHaveProperty('content_text');
    expect(spec.components.schemas).toHaveProperty('content_image');
  });

  it('entities category surfaces canonical user/page/site/session shapes', () => {
    const spec = buildContractsOpenApi();
    expect(spec.components.schemas).toHaveProperty('entities_user');
    expect(spec.components.schemas).toHaveProperty('entities_page');
    expect(spec.components.schemas).toHaveProperty('entities_site');
    expect(spec.components.schemas).toHaveProperty('entities_session');
  });

  it('lifted-from-TS-const categories surface their derived enum schemas', () => {
    const spec = buildContractsOpenApi();
    expect(spec.components.schemas).toHaveProperty('devkit_profiles_profileId');
    expect(spec.components.schemas).toHaveProperty('providers_providerId');
    expect(spec.components.schemas).toHaveProperty('stripe_webhook_events_eventType');
    expect(spec.components.schemas).toHaveProperty('content_validation_config');
    expect(spec.components.schemas).toHaveProperty('revealcoin_tokenConfig');
  });
});
