import { describe, expect, it } from 'vitest';
import {
  INFERENCE_PREREQUISITE_COPY,
  resolveInferencePrerequisite,
} from '../inference-prerequisite';

describe('resolveInferencePrerequisite', () => {
  it('reports the prerequisite unmet when no key metadata is present', () => {
    expect(resolveInferencePrerequisite(null)).toEqual({
      configured: false,
      provider: null,
    });
  });

  it('reports the prerequisite met and surfaces the configured provider', () => {
    expect(
      resolveInferencePrerequisite({ provider: 'inference-snaps', keyHint: 'sk-…abcd' }),
    ).toEqual({
      configured: true,
      provider: 'inference-snaps',
    });
  });

  it('treats any offered provider as satisfying the prerequisite', () => {
    for (const provider of ['groq', 'huggingface', 'inference-snaps', 'ollama']) {
      const result = resolveInferencePrerequisite({ provider, keyHint: null });
      expect(result.configured).toBe(true);
      expect(result.provider).toBe(provider);
    }
  });
});

describe('INFERENCE_PREREQUISITE_COPY', () => {
  it('names no proprietary vendor and uses no em dashes', () => {
    const text = `${INFERENCE_PREREQUISITE_COPY.title} ${INFERENCE_PREREQUISITE_COPY.body} ${INFERENCE_PREREQUISITE_COPY.linkLabel}`;
    expect(text).not.toContain('—');
    expect(text.toLowerCase()).not.toContain('claude');
    expect(text.toLowerCase()).not.toContain('anthropic');
  });
});
