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
});
