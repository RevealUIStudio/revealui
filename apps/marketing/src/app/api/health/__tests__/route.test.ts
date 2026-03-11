import { describe, expect, it } from 'vitest';
import { GET } from '../route';

describe('GET /api/health', () => {
  it('returns healthy status', async () => {
    const response = GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('healthy');
    expect(data.service).toBe('landing');
    expect(data.timestamp).toBeDefined();
  });

  it('returns valid ISO timestamp', async () => {
    const response = GET();
    const data = await response.json();

    const parsed = new Date(data.timestamp);
    expect(parsed.toISOString()).toBe(data.timestamp);
  });
});
