import { describe, expect, it } from 'vitest';
import { MISSING_SELF_API_URL_MESSAGE, resolveSelfApiBaseUrl } from '../self-api-url.js';

describe('resolveSelfApiBaseUrl', () => {
  it('prefers explicit override over env', () => {
    const env = {
      REVEALUI_API_URL: 'https://env.example',
    } as NodeJS.ProcessEnv;
    expect(resolveSelfApiBaseUrl('https://override.example/', env)).toBe(
      'https://override.example',
    );
  });

  it('uses REVEALUI_API_URL before NEXT_PUBLIC_API_URL and API_URL', () => {
    const env = {
      REVEALUI_API_URL: 'https://api.example/',
      NEXT_PUBLIC_API_URL: 'https://public.example',
      API_URL: 'https://legacy.example',
    } as NodeJS.ProcessEnv;
    expect(resolveSelfApiBaseUrl(undefined, env)).toBe('https://api.example');
  });

  it('falls back to NEXT_PUBLIC_API_URL then API_URL', () => {
    expect(
      resolveSelfApiBaseUrl(undefined, {
        NEXT_PUBLIC_API_URL: 'https://public.example/',
      } as NodeJS.ProcessEnv),
    ).toBe('https://public.example');
    expect(
      resolveSelfApiBaseUrl(undefined, {
        API_URL: 'http://localhost:3004/',
      } as NodeJS.ProcessEnv),
    ).toBe('http://localhost:3004');
  });

  it('returns empty string when nothing is set', () => {
    expect(resolveSelfApiBaseUrl(undefined, {} as NodeJS.ProcessEnv)).toBe('');
  });

  it('missing-config message names vault path and sync surface', () => {
    expect(MISSING_SELF_API_URL_MESSAGE).toContain('revealui/prod/public/api-url');
    expect(MISSING_SELF_API_URL_MESSAGE).toContain('revealui-api');
  });
});
