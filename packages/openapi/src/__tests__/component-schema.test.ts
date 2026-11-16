import { describe, expect, it } from 'vitest';
import { embedComponentSchema } from '../../scripts/component-schema.js';

describe('standalone schema embedding', () => {
  it('keeps reused definitions and recursive roots owned by each component', () => {
    const schema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $defs: { node: { anyOf: [{ $ref: '#' }, { type: 'null' }] } },
      properties: { child: { $ref: '#/$defs/node' } },
    };
    for (const name of ['first', 'second']) {
      expect(embedComponentSchema(name, schema)).toEqual({
        $defs: { node: { anyOf: [{ $ref: `#/components/schemas/${name}` }, { type: 'null' }] } },
        properties: { child: { $ref: `#/components/schemas/${name}/$defs/node` } },
      });
    }
    expect(schema.properties.child.$ref).toBe('#/$defs/node');
  });

  it('resolves escaped and URI-encoded JSON pointers', () => {
    const schema = {
      $defs: { 'a/b~c d': { type: 'string' } },
      $ref: '#/$defs/a~1b~0c%20d',
    };
    expect(embedComponentSchema('sample', schema)).toHaveProperty(
      '$ref',
      '#/components/schemas/sample/$defs/a~1b~0c%20d',
    );
  });

  it('preserves absolute and relative external references', () => {
    const schema = {
      anyOf: [
        { $ref: 'https://example.test/schema.json#/$defs/node' },
        { $ref: '../schema.json#/$defs/node' },
      ],
    };
    expect(embedComponentSchema('sample', schema)).toEqual(schema);
  });

  it('preserves reference ownership under root and nested $id resources', () => {
    const resource = { $id: 'https://example.test/node', properties: { next: { $ref: '#' } } };
    expect(embedComponentSchema('sample', resource)).toEqual(resource);
    expect(embedComponentSchema('sample', { $defs: { node: resource } })).toEqual({
      $defs: { node: resource },
    });
  });

  it('does not interpret defaults, examples or enum values as schemas', () => {
    const value = { $ref: '#/missing', $comment: 'JSON Schema serialization failed: fixture' };
    const schema = { type: 'object', default: value, examples: [value], enum: [value] };
    expect(embedComponentSchema('sample', schema)).toEqual(schema);
  });

  it.each(['#/$defs/missing', '#/default', '#/toString', '#/%ZZ'])(
    'rejects unresolved reference %s',
    ($ref) => {
      expect(() => embedComponentSchema('broken', { $ref, default: {} })).toThrow('broken');
    },
  );

  it('rejects nested serialization-error placeholders', () => {
    expect(() =>
      embedComponentSchema('broken', {
        properties: { item: { $comment: 'JSON Schema serialization failed: Date' } },
      }),
    ).toThrow(/broken.*serialization/i);
  });

  it('rebases named anchors to their owning subschema', () => {
    expect(
      embedComponentSchema('sample', {
        $defs: { node: { $anchor: 'node', type: 'string' } },
        $ref: '#node',
      }),
    ).toHaveProperty('$ref', '#/components/schemas/sample/$defs/node');
  });
});
