import { describe, expect, it } from 'vitest';
import { BUILT_IN_TOOLS, selectTools, webFetchTool } from '../agent/tools.js';

describe('selectTools', () => {
  it('returns all built-in tools when no allowlist is given', () => {
    expect(selectTools(undefined)).toEqual(BUILT_IN_TOOLS);
  });

  it('returns no tools for an empty allowlist', () => {
    expect(selectTools([])).toEqual([]);
  });

  it('filters to only the allowed tool names', () => {
    expect(selectTools(['web_fetch']).map((t) => t.name)).toEqual(['web_fetch']);
    expect(selectTools(['nonexistent'])).toEqual([]);
  });
});

describe('webFetchTool', () => {
  it('rejects an invalid URL', async () => {
    const result = await webFetchTool.execute({ url: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('rejects a non-http(s) protocol', async () => {
    const result = await webFetchTool.execute({ url: 'file:///etc/passwd' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/http\/https/);
  });

  it('rejects loopback hosts', async () => {
    const result = await webFetchTool.execute({ url: 'http://127.0.0.1/secret' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not allowed/);
  });

  it('rejects the cloud metadata endpoint', async () => {
    const result = await webFetchTool.execute({ url: 'http://169.254.169.254/latest/meta-data/' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not allowed/);
  });

  it('rejects private RFC1918 ranges', async () => {
    for (const url of ['http://10.0.0.5/', 'http://192.168.1.1/', 'http://172.16.0.1/']) {
      const result = await webFetchTool.execute({ url });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not allowed/);
    }
  });

  it('rejects malformed params', async () => {
    const result = await webFetchTool.execute({ notUrl: 'nope' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalid params/);
  });
});
