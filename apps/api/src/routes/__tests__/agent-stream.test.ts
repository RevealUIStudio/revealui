import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @revealui/ai  -  all dynamic imports return null by default
// ---------------------------------------------------------------------------
vi.mock('@revealui/ai', () => ({}));
vi.mock('@revealui/ai/llm/client', () => ({}));
vi.mock('@revealui/ai/orchestration/streaming-runtime', () => ({}));

import agentStream from '../agent-stream.js';

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

    // Schema accepts empty string  -  handler proceeds but AI module not available
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Mode parameter validation
// ---------------------------------------------------------------------------
describe('agent-stream route  -  mode parameter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts mode: "admin" without error', async () => {
    const app = createApp();

    const res = await jsonPost(app, '/agent-stream', {
      instruction: 'List collections',
      mode: 'admin',
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

  it('defaults to admin mode when mode is omitted', async () => {
    const app = createApp();

    const res = await jsonPost(app, '/agent-stream', {
      instruction: 'Hello',
    });

    // Schema defaults mode to 'admin'; AI not available → 403
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
      model: 'gemma4:e2b',
      mode: 'coding',
    });

    // Schema accepts all fields; AI not available → 403
    expect(res.status).toBe(403);
  });
});
