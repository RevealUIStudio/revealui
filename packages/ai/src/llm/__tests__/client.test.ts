/**
 * LLMClient — provider-health recording on embed() and stream()
 *
 * Regression guard: ProviderHealthMonitor.recordCall previously fired only on
 * chat(). embed() and stream() were invisible to health tracking. These tests
 * assert recording on both paths for success and failure, primary and fallback,
 * and that a dedicated embed-provider override is intentionally not recorded.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LLMClient } from '../client.js';
import { ProviderHealthMonitor } from '../provider-health.js';
import type { Embedding, LLMChunk, LLMProvider } from '../providers/base.js';

const { ollamaChat, ollamaEmbed, ollamaStream, groqChat, groqEmbed, groqStream } = vi.hoisted(
  () => ({
    ollamaChat: vi.fn(),
    ollamaEmbed: vi.fn(),
    ollamaStream: vi.fn(),
    groqChat: vi.fn(),
    groqEmbed: vi.fn(),
    groqStream: vi.fn(),
  }),
);

vi.mock('../providers/ollama.js', () => ({
  OllamaProvider: class {
    chat = ollamaChat;
    embed = ollamaEmbed;
    stream = ollamaStream;
  },
}));

vi.mock('../providers/groq.js', () => ({
  GroqProvider: class {
    chat = groqChat;
    embed = groqEmbed;
    stream = groqStream;
  },
}));

vi.mock('../providers/inference-snaps.js', () => ({
  InferenceSnapsProvider: class {
    chat = vi.fn();
    embed = vi.fn();
    stream = vi.fn();
  },
}));

const EMBEDDING: Embedding = { vector: [0.1, 0.2], dimension: 2, model: 'mock-embed' };

async function* streamChunks(...chunks: LLMChunk[]): AsyncGenerator<LLMChunk> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

/** An async iterable whose first pull rejects — models a provider that throws before any chunk. */
function failingStream(message: string): AsyncIterable<LLMChunk> {
  return {
    [Symbol.asyncIterator]: () => ({
      next: () => Promise.reject(new Error(message)),
    }),
  };
}

async function drain(stream: AsyncIterable<LLMChunk>): Promise<LLMChunk[]> {
  const chunks: LLMChunk[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return chunks;
}

function makeClient(healthMonitor?: ProviderHealthMonitor): LLMClient {
  return new LLMClient({
    provider: 'ollama',
    apiKey: 'test-key',
    fallbackProvider: 'groq',
    healthMonitor,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('LLMClient health recording — embed()', () => {
  it('records a successful primary embed', async () => {
    ollamaEmbed.mockResolvedValueOnce(EMBEDDING);
    const monitor = new ProviderHealthMonitor();

    const result = await makeClient(monitor).embed('hello');

    expect(result).toEqual(EMBEDDING);
    expect(monitor.getHealth('ollama')).toMatchObject({ sampleCount: 1, errorRate: 0 });
    expect(monitor.getHealth('groq').sampleCount).toBe(0);
  });

  it('records primary failure then fallback success', async () => {
    ollamaEmbed.mockRejectedValueOnce(new Error('primary embed down'));
    groqEmbed.mockResolvedValueOnce(EMBEDDING);
    const monitor = new ProviderHealthMonitor();

    const result = await makeClient(monitor).embed('hello');

    expect(result).toEqual(EMBEDDING);
    expect(monitor.getHealth('ollama')).toMatchObject({ sampleCount: 1, errorRate: 1 });
    expect(monitor.getHealth('groq')).toMatchObject({ sampleCount: 1, errorRate: 0 });
  });

  it('does not record health for a dedicated embed-provider override', async () => {
    const overrideEmbed = vi.fn(async () => EMBEDDING);
    const embedProvider: LLMProvider = {
      chat: vi.fn(),
      embed: overrideEmbed,
      stream: vi.fn(),
    };
    const monitor = new ProviderHealthMonitor();
    const client = new LLMClient({
      provider: 'ollama',
      apiKey: 'test-key',
      embedProvider,
      healthMonitor: monitor,
    });

    await client.embed('hello');

    expect(overrideEmbed).toHaveBeenCalledOnce();
    expect(ollamaEmbed).not.toHaveBeenCalled();
    expect(monitor.getHealth('ollama').sampleCount).toBe(0);
  });
});

describe('LLMClient health recording — stream()', () => {
  it('records a successful primary stream at time-to-first-chunk', async () => {
    ollamaStream.mockImplementation(() =>
      streamChunks({ content: 'a', done: false }, { content: 'b', done: true }),
    );
    const monitor = new ProviderHealthMonitor();

    const chunks = await drain(makeClient(monitor).stream([{ role: 'user', content: 'hi' }]));

    expect(chunks).toHaveLength(2);
    expect(monitor.getHealth('ollama')).toMatchObject({ sampleCount: 1, errorRate: 0 });
  });

  it('records primary failure then fallback success', async () => {
    ollamaStream.mockImplementation(() => failingStream('primary stream down'));
    groqStream.mockImplementation(() => streamChunks({ content: 'fallback', done: true }));
    const monitor = new ProviderHealthMonitor();

    const chunks = await drain(makeClient(monitor).stream([{ role: 'user', content: 'hi' }]));

    expect(chunks).toEqual([{ content: 'fallback', done: true }]);
    expect(monitor.getHealth('ollama')).toMatchObject({ sampleCount: 1, errorRate: 1 });
    expect(monitor.getHealth('groq')).toMatchObject({ sampleCount: 1, errorRate: 0 });
  });
});

describe('LLMClient health recording — optional monitor', () => {
  it('embed() and stream() run without a configured monitor', async () => {
    ollamaEmbed.mockResolvedValueOnce(EMBEDDING);
    ollamaStream.mockImplementation(() => streamChunks({ content: 'a', done: true }));
    const client = makeClient(undefined);

    await expect(client.embed('hello')).resolves.toEqual(EMBEDDING);
    await expect(drain(client.stream([{ role: 'user', content: 'hi' }]))).resolves.toHaveLength(1);
  });
});
