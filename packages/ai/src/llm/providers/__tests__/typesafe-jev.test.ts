import { describe, expect, it } from 'vitest';
import { evaluateJev, JevConfigError, JEV_MODEL, typesafeApiKey } from '../typesafe-jev.js';

describe('evaluateJev', () => {
  it('refuses to run without a caller-supplied key', () => {
    expect(() => typesafeApiKey({})).toThrow(JevConfigError);
  });

  it('posts state and typed questions and returns the answers', async () => {
    let seenUrl = '';
    let seenAuth = '';
    let seenBody = '';
    const fetchImpl: typeof fetch = async (url, init) => {
      seenUrl = String(url);
      seenAuth = String((init?.headers as Record<string, string>).Authorization);
      seenBody = String(init?.body);
      return new Response(
        JSON.stringify({
          model: 'jev-1.13.0',
          answers: { is_urgent: { type: 'noul', noul: 1 } },
          usage: { input_tokens: 12, output_tokens: 1 },
        }),
        { status: 200 },
      );
    };

    const result = await evaluateJev(
      {
        state: 'need this today',
        questions: { is_urgent: { type: 'noul', instructions: 'The message is urgent' } },
      },
      { fetchImpl, apiKey: 'test-key' },
    );

    expect(seenUrl).toBe('https://api.typesafe.ai/v1/systemone');
    expect(seenAuth).toBe('Bearer test-key');
    expect(JSON.parse(seenBody).model).toBe(JEV_MODEL);
    expect(result.answers.is_urgent).toEqual({ type: 'noul', noul: 1 });
  });
});
