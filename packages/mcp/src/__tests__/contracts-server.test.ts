/**
 * Tests for `createContractsServer()` (F8 Phase 1 of the contracts
 * protocol-pyramid ADR).
 *
 * Coverage targets:
 *   - Factory + structure (server identity, tool count, resource count).
 *   - Resource list + read (catalog + per-category).
 *   - Tool dispatch — `contracts_list_categories`, `contracts_get_schema`,
 *     `contracts_validate_<category>` (one per category).
 *   - Validation pipeline — happy + sad path per category × N categories.
 *   - Edge cases — missing args, unknown category/schema/URI/tool.
 *
 * Per ADR Phase 1 acceptance criteria: ≥34 unit tests (1 happy + 1 sad
 * per category, 17 minimum). Actual count comfortably exceeds the
 * minimum via per-category parameterization + structural coverage.
 */

import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { describe, expect, it } from 'vitest';
import {
  createContractsServer,
  REGISTERED_CATEGORIES,
  REVEALCOIN_TOKEN_DEFAULT,
  validatePayload,
} from '../servers/factories/contracts.js';

// ---------------------------------------------------------------------------
// Test helpers — invoke a Server's request handlers without standing up a
// transport. The MCP SDK exposes private handlers via the `_requestHandlers`
// internal Map; we read it via a typed escape hatch (we don't mutate).
// ---------------------------------------------------------------------------

interface TextContentBlock {
  type: 'text';
  text: string;
}

interface ToolCallResponse {
  content: TextContentBlock[];
  isError?: boolean;
}

interface ResourceListResponse {
  resources: Array<{ uri: string; name: string; description?: string; mimeType?: string }>;
}

interface ToolListResponse {
  tools: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>;
}

interface ResourceReadResponse {
  contents: Array<{ uri: string; mimeType?: string; text?: string }>;
}

// biome-ignore lint/suspicious/noExplicitAny: SDK private surface — typed re-cast at the call site.
function getHandler(server: ReturnType<typeof createContractsServer>, schemaName: string): any {
  // The MCP SDK stores handlers keyed by the Zod schema's parsed `method` literal.
  // Walk the underlying Map; cast through `unknown` to satisfy strict TS.
  const internal = server as unknown as {
    _requestHandlers: Map<string, (request: unknown) => unknown>;
  };
  const handler = internal._requestHandlers.get(schemaName);
  if (!handler) {
    throw new Error(`No handler registered for ${schemaName}`);
  }
  return handler;
}

async function listTools(
  server: ReturnType<typeof createContractsServer>,
): Promise<ToolListResponse> {
  // Server stores handlers by the literal method name (e.g. "tools/list").
  const handler = getHandler(server, 'tools/list');
  return (await handler({ method: 'tools/list', params: {} })) as ToolListResponse;
}

async function listResources(
  server: ReturnType<typeof createContractsServer>,
): Promise<ResourceListResponse> {
  const handler = getHandler(server, 'resources/list');
  return (await handler({ method: 'resources/list', params: {} })) as ResourceListResponse;
}

async function readResource(
  server: ReturnType<typeof createContractsServer>,
  uri: string,
): Promise<ResourceReadResponse> {
  const handler = getHandler(server, 'resources/read');
  return (await handler({ method: 'resources/read', params: { uri } })) as ResourceReadResponse;
}

async function callTool(
  server: ReturnType<typeof createContractsServer>,
  name: string,
  args: Record<string, unknown> = {},
): Promise<ToolCallResponse> {
  const handler = getHandler(server, 'tools/call');
  return (await handler({
    method: 'tools/call',
    params: { name, arguments: args },
  })) as ToolCallResponse;
}

function parseJson(text: string): unknown {
  return JSON.parse(text);
}

// Sanity — these constants are imported elsewhere too; keep TS happy.
void CallToolRequestSchema;
void ListResourcesRequestSchema;
void ListToolsRequestSchema;
void ReadResourceRequestSchema;

// ---------------------------------------------------------------------------
// Happy-path fixtures per category.
//
// Each entry is a minimal-valid payload that the category's PRIMARY schema
// will accept under `safeParse`. Where the primary schema requires deeply
// nested data, we prefer a non-primary schema with a simpler shape (the
// validate tool accepts `{ schema, data }` so we can target specifically).
// ---------------------------------------------------------------------------

interface HappyFixture {
  /** Optional explicit schema within the category. Defaults to primary. */
  schema?: string;
  data: unknown;
}

/**
 * Per-category happy fixtures. Tests run validate on the primary schema by
 * default, but some categories need a non-primary target because the primary
 * is structurally complex (large discriminated unions, recursive shapes,
 * etc.). When `schema` is set, the test uses that override.
 */
const HAPPY_FIXTURES: Record<string, HappyFixture> = {
  // a2a primary = agentCard (complex). Use `taskState` enum instead.
  a2a: { schema: 'taskState', data: 'submitted' },
  // admin primary = collection (very deep). Use config which is also deep,
  // so target a synthetic minimal config — config refines that there must
  // be at least one collection OR global, so include a minimal collection.
  admin: {
    schema: 'config',
    data: {
      secret: 'placeholder-secret-1234567890',
      collections: [{ slug: 'pages', fields: [{ name: 'title', type: 'text' }] }],
    },
  },
  // agents primary = agentMemory (requires id + embedding). Use intentType.
  agents: { schema: 'intentType', data: 'create' },
  // api_auth primary = signIn.
  api_auth: {
    schema: 'signIn',
    data: { email: 'a@b.co', password: 'examplepass1' },
  },
  // api_chat primary = chatRequest (requires messages array). Use chatMessage.
  api_chat: {
    schema: 'chatMessage',
    data: { role: 'user', content: 'hi' },
  },
  // api_gdpr primary = gdprExport.
  api_gdpr: { schema: 'gdprExport', data: { userId: 'u-1' } },
  // content primary = block (discriminated union). Use blockMeta.
  content: {
    schema: 'blockMeta',
    data: { id: 'b-1' },
  },
  // content_validation primary = config.
  content_validation: { data: { maxDepth: 10, maxSizeBytes: 1024 } },
  // devkit_profiles primary = profileId (z.enum).
  devkit_profiles: { data: 'revealui' },
  // entities primary = user. Use pageLock (smaller). Schema requires
  // userId + lockedAt + expiresAt (datetimes).
  entities: {
    schema: 'pageLock',
    data: {
      userId: 'u-1',
      lockedAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
    },
  },
  // generated primary = usersInsert (drizzle-zod). Sessions has tokenHash
  // (not token); shape comes from drizzle-zod over the sessions table.
  generated: {
    schema: 'sessionsInsert',
    data: {
      id: 's-1',
      userId: 'u-1',
      tokenHash: 'hashed-token-placeholder',
      expiresAt: new Date(),
    },
  },
  // providers primary = providerId (z.enum).
  providers: { data: 'groq' },
  // representation primary = dualEntity. Use embedding (simpler) — actual
  // schema uses singular `dimension` + `generatedAt` timestamp.
  representation: {
    schema: 'embedding',
    data: {
      vector: [0.1, 0.2, 0.3],
      dimension: 3,
      model: 'test',
      generatedAt: new Date().toISOString(),
    },
  },
  // revealcoin primary = tokenConfig. Reuse the canonical default.
  revealcoin: {
    data: {
      ...REVEALCOIN_TOKEN_DEFAULT,
      // Cast bigint-or-string union: serialize as string for portability.
      totalSupply: String(REVEALCOIN_TOKEN_DEFAULT.totalSupply),
    },
  },
  // secrets primary = secretActor.
  secrets: { data: { type: 'user', id: 'u-1' } },
  // security primary = securityRule. Use severity (z.enum).
  security: { schema: 'severity', data: 'error' },
  // stripe_webhook_events primary = eventType (z.enum).
  stripe_webhook_events: { data: 'customer.subscription.created' },
};

// ---------------------------------------------------------------------------
// Sad-path fixtures — uniform "obviously invalid" inputs that every Zod
// schema rejects (most safeParse on `null`/`42`/`{ malformed: true }`).
// ---------------------------------------------------------------------------

const SAD_PAYLOADS: ReadonlyArray<unknown> = [null, 42, 'not-an-object'];

// ---------------------------------------------------------------------------
// Suites
// ---------------------------------------------------------------------------

describe('createContractsServer — factory + structure', () => {
  it('returns a Server instance', () => {
    const server = createContractsServer();
    expect(server).toBeDefined();
    // Server has a connect method per @modelcontextprotocol/sdk Server class.
    expect(typeof (server as unknown as { connect: unknown }).connect).toBe('function');
  });

  it('registers handlers for tools/list, tools/call, resources/list, resources/read (plus SDK defaults)', () => {
    const server = createContractsServer();
    const internal = server as unknown as { _requestHandlers: Map<string, unknown> };
    // SDK base class registers `ping` + `initialize` handlers automatically;
    // we just assert OUR four are present (don't pin total count, which is
    // an SDK implementation detail subject to change).
    expect(internal._requestHandlers.has('tools/list')).toBe(true);
    expect(internal._requestHandlers.has('tools/call')).toBe(true);
    expect(internal._requestHandlers.has('resources/list')).toBe(true);
    expect(internal._requestHandlers.has('resources/read')).toBe(true);
  });

  it('REGISTERED_CATEGORIES exposes ≥17 categories', () => {
    expect(REGISTERED_CATEGORIES.length).toBeGreaterThanOrEqual(17);
  });

  it('every registered category has a happy fixture defined', () => {
    for (const cat of REGISTERED_CATEGORIES) {
      expect(HAPPY_FIXTURES).toHaveProperty(cat);
    }
  });

  it('accepts a serverName override for multi-server-in-process tests', () => {
    const server = createContractsServer({ serverName: 'alt' });
    expect(server).toBeDefined();
  });
});

describe('createContractsServer — tool list', () => {
  it('lists tools/list = 2 discovery tools + 1 validate tool per category', async () => {
    const server = createContractsServer();
    const result = await listTools(server);
    // 2 discovery (list_categories, get_schema) + N validate_<cat>
    expect(result.tools.length).toBe(2 + REGISTERED_CATEGORIES.length);
  });

  it('exposes contracts_list_categories tool with empty input schema', async () => {
    const server = createContractsServer();
    const result = await listTools(server);
    const tool = result.tools.find((t) => t.name === 'contracts_list_categories');
    expect(tool).toBeDefined();
    expect((tool?.inputSchema as { properties: Record<string, unknown> })?.properties).toEqual({});
  });

  it('exposes contracts_get_schema tool with required category arg', async () => {
    const server = createContractsServer();
    const result = await listTools(server);
    const tool = result.tools.find((t) => t.name === 'contracts_get_schema');
    expect(tool).toBeDefined();
    expect((tool?.inputSchema as { required?: string[] })?.required).toContain('category');
  });

  it('exposes one contracts_validate_<category> tool per registered category', async () => {
    const server = createContractsServer();
    const result = await listTools(server);
    for (const cat of REGISTERED_CATEGORIES) {
      const tool = result.tools.find((t) => t.name === `contracts_validate_${cat}`);
      expect(tool, `contracts_validate_${cat} should be present`).toBeDefined();
      expect((tool?.inputSchema as { required?: string[] })?.required).toContain('data');
    }
  });
});

describe('createContractsServer — resource list', () => {
  it('lists 1 catalog + 1 per category', async () => {
    const server = createContractsServer();
    const result = await listResources(server);
    expect(result.resources.length).toBe(1 + REGISTERED_CATEGORIES.length);
  });

  it('catalog resource is at revealui-contracts://catalog with json mimeType', async () => {
    const server = createContractsServer();
    const result = await listResources(server);
    const catalog = result.resources.find((r) => r.uri === 'revealui-contracts://catalog');
    expect(catalog).toBeDefined();
    expect(catalog?.mimeType).toBe('application/json');
  });

  it('every category has a resource at revealui-contracts://<category>', async () => {
    const server = createContractsServer();
    const result = await listResources(server);
    for (const cat of REGISTERED_CATEGORIES) {
      const resource = result.resources.find((r) => r.uri === `revealui-contracts://${cat}`);
      expect(resource, `Resource for ${cat} should be present`).toBeDefined();
      expect(resource?.mimeType).toBe('application/json');
    }
  });
});

describe('createContractsServer — resources/read', () => {
  it('returns the catalog payload with totalCategories + totalSchemas', async () => {
    const server = createContractsServer();
    const result = await readResource(server, 'revealui-contracts://catalog');
    expect(result.contents.length).toBe(1);
    const body = parseJson(result.contents[0].text ?? '') as {
      categories: unknown[];
      totalCategories: number;
      totalSchemas: number;
    };
    expect(body.totalCategories).toBe(REGISTERED_CATEGORIES.length);
    expect(body.totalSchemas).toBeGreaterThan(0);
    expect(Array.isArray(body.categories)).toBe(true);
  });

  it('returns category JSON with primarySchema + schemas map', async () => {
    const server = createContractsServer();
    const result = await readResource(server, 'revealui-contracts://devkit_profiles');
    const body = parseJson(result.contents[0].text ?? '') as {
      category: string;
      primarySchema: string;
      schemas: Record<string, unknown>;
    };
    expect(body.category).toBe('devkit_profiles');
    expect(body.primarySchema).toBe('profileId');
    expect(body.schemas.profileId).toBeDefined();
  });

  it('throws on unknown URI scheme', async () => {
    const server = createContractsServer();
    await expect(readResource(server, 'http://example.com/foo')).rejects.toThrow(
      /Unknown resource URI/,
    );
  });

  it('throws on revealui-contracts URI for unknown category', async () => {
    const server = createContractsServer();
    await expect(readResource(server, 'revealui-contracts://nonexistent')).rejects.toThrow(
      /Unknown resource URI/,
    );
  });

  // Per-category resource read smoke tests — proves every category serializes
  // its schemas to JSON Schema without throwing (failures fall back to a
  // `$comment` placeholder, which is fine; we just want the read to succeed).
  for (const cat of [
    'a2a',
    'admin',
    'agents',
    'api_auth',
    'api_chat',
    'api_gdpr',
    'content',
    'content_validation',
    'devkit_profiles',
    'entities',
    'generated',
    'providers',
    'representation',
    'revealcoin',
    'secrets',
    'security',
    'stripe_webhook_events',
  ] as const) {
    it(`resources/read for ${cat} returns valid JSON with primarySchema field`, async () => {
      const server = createContractsServer();
      const result = await readResource(server, `revealui-contracts://${cat}`);
      const body = parseJson(result.contents[0].text ?? '') as {
        category: string;
        primarySchema: string;
        schemas: Record<string, unknown>;
      };
      expect(body.category).toBe(cat);
      expect(typeof body.primarySchema).toBe('string');
      expect(body.primarySchema.length).toBeGreaterThan(0);
      expect(Object.keys(body.schemas).length).toBeGreaterThan(0);
    });
  }
});

describe('createContractsServer — contracts_list_categories tool', () => {
  it('returns a payload identical to the catalog resource', async () => {
    const server = createContractsServer();
    const toolResp = await callTool(server, 'contracts_list_categories');
    expect(toolResp.isError).toBeFalsy();
    const body = parseJson(toolResp.content[0].text) as { totalCategories: number };
    expect(body.totalCategories).toBe(REGISTERED_CATEGORIES.length);
  });
});

describe('createContractsServer — contracts_get_schema tool', () => {
  it('returns the JSON Schema for primary by default', async () => {
    const server = createContractsServer();
    const resp = await callTool(server, 'contracts_get_schema', { category: 'devkit_profiles' });
    expect(resp.isError).toBeFalsy();
    const body = parseJson(resp.content[0].text) as {
      category: string;
      schema: string;
      jsonSchema: unknown;
    };
    expect(body.category).toBe('devkit_profiles');
    expect(body.schema).toBe('profileId');
    expect(body.jsonSchema).toBeDefined();
  });

  it('returns the JSON Schema for an explicit schema name', async () => {
    const server = createContractsServer();
    const resp = await callTool(server, 'contracts_get_schema', {
      category: 'agents',
      schema: 'memoryType',
    });
    expect(resp.isError).toBeFalsy();
    const body = parseJson(resp.content[0].text) as { schema: string };
    expect(body.schema).toBe('memoryType');
  });

  it('errors on unknown category', async () => {
    const server = createContractsServer();
    const resp = await callTool(server, 'contracts_get_schema', { category: 'bogus' });
    expect(resp.isError).toBe(true);
    expect(resp.content[0].text).toMatch(/Unknown category/);
  });

  it('errors on unknown schema within a known category', async () => {
    const server = createContractsServer();
    const resp = await callTool(server, 'contracts_get_schema', {
      category: 'agents',
      schema: 'doesNotExist',
    });
    expect(resp.isError).toBe(true);
    expect(resp.content[0].text).toMatch(/Unknown schema/);
  });
});

// ---------------------------------------------------------------------------
// Validation pipeline — happy + sad path per category (the ADR's 34-test
// minimum lives here).
// ---------------------------------------------------------------------------

describe('createContractsServer — contracts_validate_<category> happy paths', () => {
  for (const cat of REGISTERED_CATEGORIES) {
    const fixture = HAPPY_FIXTURES[cat];
    it(`validates ${cat}${fixture.schema ? `/${fixture.schema}` : ''} happy fixture as success`, async () => {
      const server = createContractsServer();
      const args: Record<string, unknown> = { data: fixture.data };
      if (fixture.schema) args.schema = fixture.schema;
      const resp = await callTool(server, `contracts_validate_${cat}`, args);
      const body = parseJson(resp.content[0].text) as {
        success: boolean;
        category: string;
        schema: string;
        data?: unknown;
        issues?: unknown[];
      };
      expect(
        body.success,
        `Expected success for ${cat}/${body.schema}; got issues: ${JSON.stringify(body.issues)}`,
      ).toBe(true);
      expect(body.category).toBe(cat);
      expect(resp.isError).toBeFalsy();
    });
  }
});

describe('createContractsServer — contracts_validate_<category> sad paths', () => {
  for (const cat of REGISTERED_CATEGORIES) {
    const fixture = HAPPY_FIXTURES[cat];
    // Pick a sad payload guaranteed to be wrong shape (null on enum/object/etc.)
    const sadPayload = SAD_PAYLOADS[0];
    it(`rejects null payload for ${cat}${fixture.schema ? `/${fixture.schema}` : ''} as failure`, async () => {
      const server = createContractsServer();
      const args: Record<string, unknown> = { data: sadPayload };
      if (fixture.schema) args.schema = fixture.schema;
      const resp = await callTool(server, `contracts_validate_${cat}`, args);
      const body = parseJson(resp.content[0].text) as {
        success: boolean;
        issues?: unknown[];
      };
      expect(body.success).toBe(false);
      expect(Array.isArray(body.issues)).toBe(true);
      expect((body.issues ?? []).length).toBeGreaterThan(0);
      expect(resp.isError).toBe(true);
    });
  }
});

describe('createContractsServer — validation edge cases', () => {
  it('errors when data argument is missing', async () => {
    const server = createContractsServer();
    const resp = await callTool(server, 'contracts_validate_devkit_profiles', {});
    expect(resp.isError).toBe(true);
    expect(resp.content[0].text).toMatch(/"data" is required/);
  });

  it('errors when invoked tool is unknown', async () => {
    const server = createContractsServer();
    const resp = await callTool(server, 'unknown_tool_does_not_exist');
    expect(resp.isError).toBe(true);
    expect(resp.content[0].text).toMatch(/Unknown tool/);
  });

  it('errors when contracts_validate_ targets a derived but missing category', async () => {
    const server = createContractsServer();
    const resp = await callTool(server, 'contracts_validate_bogus_category');
    expect(resp.isError).toBe(true);
    expect(resp.content[0].text).toMatch(/Unknown category/);
  });

  it('returns unknown_schema issue when validating against a non-existent schema name', async () => {
    const server = createContractsServer();
    const resp = await callTool(server, 'contracts_validate_devkit_profiles', {
      schema: 'doesNotExist',
      data: 'revealui',
    });
    expect(resp.isError).toBe(true);
    const body = parseJson(resp.content[0].text) as {
      success: boolean;
      issues: Array<{ code: string }>;
    };
    expect(body.success).toBe(false);
    expect(body.issues[0]?.code).toBe('unknown_schema');
  });
});

// ---------------------------------------------------------------------------
// Direct-call API (validatePayload) — exposed for in-process consumers.
// ---------------------------------------------------------------------------

describe('validatePayload — exported direct API', () => {
  it('returns success on valid input', () => {
    const result = validatePayload('devkit_profiles', 'profileId', 'revealui');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('revealui');
    }
  });

  it('returns failure with issues on invalid input', () => {
    const result = validatePayload('devkit_profiles', 'profileId', 'not-a-profile');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.length).toBeGreaterThan(0);
    }
  });

  it('returns unknown_schema code when schemaName is bogus', () => {
    const result = validatePayload('devkit_profiles', 'bogus', 'revealui');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues[0]?.code).toBe('unknown_schema');
    }
  });

  it('preserves category + schema in failure return', () => {
    const result = validatePayload('providers', 'providerId', 'wrong-provider');
    expect(result.category).toBe('providers');
    expect(result.schema).toBe('providerId');
  });
});
