import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @revealui/ai — all dynamic imports return null by default
// ---------------------------------------------------------------------------
vi.mock('@revealui/ai', () => ({}));
vi.mock('@revealui/ai/llm/client', () => ({}));
vi.mock('@revealui/ai/orchestration/streaming-runtime', () => ({}));

import agentStream, { detectProvider } from '../agent-stream.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createApp() {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('user', { id: 'test-user', role: 'admin' });
    await next();
  });
  app.route('/agent-stream', agentStream);
  return app;
}

function jsonPost(app: Hono, path: string, body: unknown, headers?: Record<string, string>) {
  return app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

// biome-ignore lint/suspicious/noExplicitAny: test helper
async function parseBody(res: Response): Promise<any> {
  return res.json();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('agent-stream route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when instruction is missing', async () => {
    const app = createApp();

    const res = await jsonPost(app, '/agent-stream', {});

    // OpenAPI zod validation rejects missing required 'instruction' field
    expect(res.status).toBe(400);
  });

  it('returns 400 when body is empty', async () => {
    const app = createApp();

    const res = await jsonPost(app, '/agent-stream', null);

    expect(res.status).toBe(400);
  });

  it('returns 403 when AI package is not available', async () => {
    const app = createApp();

    const res = await jsonPost(app, '/agent-stream', {
      instruction: 'Hello',
    });

    expect(res.status).toBe(403);
    const body = await parseBody(res);
    expect(body.error).toContain('requires a Pro or Enterprise license');
  });

  it('returns 403 with empty instruction string (AI not configured)', async () => {
    const app = createApp();

    const res = await jsonPost(app, '/agent-stream', {
      instruction: '',
    });

    // Schema accepts empty string — handler proceeds but AI module not available
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// BYOK provider detection
// ---------------------------------------------------------------------------
describe('detectProvider', () => {
  it('routes sk-ant-* keys to anthropic', () => {
    expect(detectProvider('sk-ant-api03-abc123')).toBe('anthropic');
  });

  it('routes sk-* keys to openai', () => {
    expect(detectProvider('sk-proj-abc123')).toBe('openai');
  });

  it('routes gsk_* keys to groq', () => {
    expect(detectProvider('gsk_abc123')).toBe('groq');
  });

  it('routes hf_* keys to huggingface', () => {
    expect(detectProvider('hf_abc123')).toBe('huggingface');
  });

  it('uses explicit provider parameter when provided', () => {
    expect(detectProvider('some-key', 'ollama')).toBe('ollama');
  });

  it('returns null for undetectable keys without provider hint', () => {
    expect(detectProvider('random-key-format')).toBeNull();
  });

  it('prefers explicit provider over key prefix detection', () => {
    expect(detectProvider('sk-ant-abc123', 'groq')).toBe('groq');
  });

  it('returns null for a Vultr-style key with no provider hint', () => {
    // Vultr keys have no standard prefix — explicit provider is required
    expect(detectProvider('vultr-abc123-xyz')).toBeNull();
  });

  it('routes a Vultr-style key when provider is explicitly "vultr"', () => {
    expect(detectProvider('vultr-abc123-xyz', 'vultr')).toBe('vultr');
  });

  it('routes a Groq-prefix key to openai when explicit provider overrides', () => {
    // gsk_ would normally resolve to groq; explicit provider wins
    expect(detectProvider('gsk_abc123', 'openai')).toBe('openai');
  });

  it('routes a key with "ollama" explicit provider regardless of key format', () => {
    expect(detectProvider('any-key-format', 'ollama')).toBe('ollama');
  });
});

// ---------------------------------------------------------------------------
// BYOK route paths (AI modules return {} — truthy but constructor-less)
// ---------------------------------------------------------------------------
// The top-level vi.mock calls make all three @revealui/ai modules return {}.
// An empty object is truthy, so the 403 "module unavailable" gate is bypassed.
// However, calling new llmClientMod.LLMClient() or aiMod.createLLMClientFromEnv()
// on an empty-object mock throws, landing in the catch block (→ 403).
// The one exception is the BYOK 400 path: detectProvider is called BEFORE
// any constructor, so an undetectable key returns 400 before the catch.
// ---------------------------------------------------------------------------
describe('agent-stream route — BYOK and auth-header paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when BYOK key has no detectable provider and no provider hint', async () => {
    const app = createApp();

    // Bearer token with a Vultr-style key (no prefix, no provider body field)
    const res = await jsonPost(
      app,
      '/agent-stream',
      { instruction: 'Do something' },
      { Authorization: 'Bearer vultr-undetectable-key-123' },
    );

    expect(res.status).toBe(400);
    const body = await parseBody(res);
    expect(body.success).toBe(false);
    expect(body.error).toContain('Cannot detect LLM provider');
  });

  it('returns 400 when BYOK key is unrecognised even with a long random format', async () => {
    const app = createApp();

    const res = await jsonPost(
      app,
      '/agent-stream',
      { instruction: 'Summarise this' },
      { Authorization: 'Bearer xyzzy-totally-unknown-format-abc' },
    );

    expect(res.status).toBe(400);
    const body = await parseBody(res);
    expect(body.error).toContain('Cannot detect LLM provider');
  });

  it('bypasses the 400 provider check when undetectable key provides explicit provider', async () => {
    const app = createApp();

    // key is undetectable, but body.provider='vultr' → detectProvider returns 'vultr'
    // → proceeds to new LLMClient() which throws on the {} mock → 403 (not 400)
    const res = await jsonPost(
      app,
      '/agent-stream',
      { instruction: 'Hello', provider: 'vultr' },
      { Authorization: 'Bearer vultr-undetectable-key-123' },
    );

    // detectProvider returns 'vultr', so we skip the 400 path; constructor throws → 403
    expect(res.status).toBe(403);
  });

  it('returns 403 (not 400) when BYOK key is a valid sk-ant- prefix', async () => {
    const app = createApp();

    // detectProvider returns 'anthropic' → proceeds to new LLMClient() which
    // throws on the {} mock → catch block → 403
    const res = await jsonPost(
      app,
      '/agent-stream',
      { instruction: 'Hello' },
      { Authorization: 'Bearer sk-ant-api03-validlookingkey' },
    );

    expect(res.status).toBe(403);
    const body = await parseBody(res);
    expect(body.error).toContain('requires a Pro or Enterprise license');
  });

  it('returns 403 (not 400) when BYOK key is a valid openai sk- prefix', async () => {
    const app = createApp();

    const res = await jsonPost(
      app,
      '/agent-stream',
      { instruction: 'List my tasks' },
      { Authorization: 'Bearer sk-proj-openaikey123abc' },
    );

    expect(res.status).toBe(403);
    const body = await parseBody(res);
    expect(body.error).toContain('requires a Pro or Enterprise license');
  });

  it('returns 403 when Authorization header does not start with "Bearer "', async () => {
    const app = createApp();

    // Non-Bearer scheme → byokKey is undefined → falls to createLLMClientFromEnv()
    // which throws on the {} mock → catch → 403
    const res = await jsonPost(
      app,
      '/agent-stream',
      { instruction: 'Hello' },
      { Authorization: 'Token some-api-token' },
    );

    expect(res.status).toBe(403);
  });

  it('returns 403 when Authorization header is present but empty after "Bearer "', async () => {
    const app = createApp();

    // 'Bearer ' with nothing after it → byokKey = '' (falsy) → env path → 403
    const res = await jsonPost(
      app,
      '/agent-stream',
      { instruction: 'Hello' },
      { Authorization: 'Bearer ' },
    );

    expect(res.status).toBe(403);
  });

  it('returns 403 (not 400) when BYOK provider is explicit "groq" with valid gsk_ key', async () => {
    const app = createApp();

    // Explicit provider supplied; detectProvider returns 'groq' → LLMClient() throws → 403
    const res = await jsonPost(
      app,
      '/agent-stream',
      { instruction: 'Answer this', provider: 'groq' },
      { Authorization: 'Bearer gsk_validgroqkey' },
    );

    expect(res.status).toBe(403);
  });

  it('accepts all optional body fields and still returns 403 when AI unavailable', async () => {
    const app = createApp();

    const res = await jsonPost(app, '/agent-stream', {
      instruction: 'Run a full analysis',
      boardId: 'board-42',
      workspaceId: 'ws-99',
      priority: 'high',
      provider: 'openai',
      model: 'gpt-4o-mini',
    });

    // Schema accepts all optional fields; AI modules not available → 403
    expect(res.status).toBe(403);
    const body = await parseBody(res);
    expect(body.success).toBe(false);
    expect(body.code).toBe('HTTP_403');
  });

  it('returns 400 when BYOK is undetectable regardless of other optional fields', async () => {
    const app = createApp();

    const res = await jsonPost(
      app,
      '/agent-stream',
      {
        instruction: 'Do it',
        boardId: 'board-1',
        workspaceId: 'ws-1',
        priority: 'low',
        // no provider field
      },
      { Authorization: 'Bearer unknown-key-format-xyz' },
    );

    expect(res.status).toBe(400);
    const body = await parseBody(res);
    expect(body.error).toContain('Cannot detect LLM provider');
  });
});

// ---------------------------------------------------------------------------
// Mode parameter validation
// ---------------------------------------------------------------------------
describe('agent-stream route — mode parameter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts mode: "cms" without error', async () => {
    const app = createApp();

    const res = await jsonPost(app, '/agent-stream', {
      instruction: 'List collections',
      mode: 'cms',
    });

    // AI modules not available → 403 (schema validation passed)
    expect(res.status).toBe(403);
  });

  it('accepts mode: "coding" without error', async () => {
    const app = createApp();

    const res = await jsonPost(app, '/agent-stream', {
      instruction: 'Show project files',
      mode: 'coding',
    });

    // AI modules not available → 403 (schema validation passed)
    expect(res.status).toBe(403);
  });

  it('defaults to cms mode when mode is omitted', async () => {
    const app = createApp();

    const res = await jsonPost(app, '/agent-stream', {
      instruction: 'Hello',
    });

    // Schema defaults mode to 'cms'; AI not available → 403
    expect(res.status).toBe(403);
  });

  it('rejects invalid mode values', async () => {
    const app = createApp();

    const res = await jsonPost(app, '/agent-stream', {
      instruction: 'Hello',
      mode: 'invalid',
    });

    // OpenAPI zod validation rejects invalid enum value
    expect(res.status).toBe(400);
  });

  it('accepts mode alongside all other optional fields', async () => {
    const app = createApp();

    const res = await jsonPost(app, '/agent-stream', {
      instruction: 'Run tests',
      boardId: 'board-42',
      workspaceId: 'ws-99',
      priority: 'high',
      provider: 'ollama',
      model: 'llama3.2',
      mode: 'coding',
    });

    // Schema accepts all fields; AI not available → 403
    expect(res.status).toBe(403);
  });
});
