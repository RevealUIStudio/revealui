import { describe, expect, it, vi } from 'vitest';
import { type AdminAPIClient, createAdminTools } from '../factory.js';

function fakeClient(): AdminAPIClient {
  return {
    find: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findGlobal: vi.fn(),
    updateGlobal: vi.fn(),
  };
}

describe('createAdminTools include', () => {
  it('returns the full catalog when include is omitted', () => {
    const tools = createAdminTools({ apiClient: fakeClient() });
    expect(tools.map((t) => t.name)).toContain('create_user');
    expect(tools.map((t) => t.name)).toContain('find_documents');
  });

  it('returns only named tools when include is set', () => {
    const tools = createAdminTools({
      apiClient: fakeClient(),
      include: ['find_documents', 'create_document'],
    });
    expect(tools.map((t) => t.name).sort()).toEqual(['create_document', 'find_documents']);
    expect(tools.some((t) => t.name === 'create_user')).toBe(false);
  });
});
