import { describe, expect, it } from 'vitest';
import { welcomeFirstDayCta } from '../welcome-first-day';

describe('welcomeFirstDayCta', () => {
  it('sends Free to pages, not /agents', () => {
    const cta = welcomeFirstDayCta('free');
    expect(cta.href).toBe('/pages');
    expect(cta.title).toBe('Create your first page');
    expect(cta.body).toContain('does not unlock Pro agents');
  });

  it('sends Pro and Max to agents', () => {
    expect(welcomeFirstDayCta('pro').href).toBe('/agents');
    expect(welcomeFirstDayCta('max').href).toBe('/agents');
    expect(welcomeFirstDayCta('max').title).toBe('Run your first agent');
  });
});
