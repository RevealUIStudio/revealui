import { describe, expect, it, vi } from 'vitest';
import { buildContractsOpenApi } from '../../scripts/emit-from-mcp.js';

const fixture = vi.hoisted(() => ({ schema: {} as unknown }));
vi.mock('@revealui/mcp/contracts-server', () => ({
  getContractsCatalog: () => ({ fixture: { schemas: { broken: fixture.schema } } }),
}));

describe('contract emission failure gates', () => {
  it.each([
    { $comment: 'JSON Schema serialization failed: unsupported type' },
    { properties: { nested: { $comment: 'JSON Schema serialization failed: unsupported type' } } },
    { $ref: '#/$defs/missing' },
  ])('refuses to build a document containing %j', (schema) => {
    fixture.schema = schema;
    expect(() => buildContractsOpenApi()).toThrow('fixture_broken');
  });
});
