type JsonRecord = Record<string, unknown>;
type Context = 'document' | 'schema-map' | 'property-map' | 'schema';

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const DATA_FIELDS = new Set(['example', 'examples', 'default', 'enum']);
const SCHEMA_CHILDREN = new Set([
  'items',
  'additionalProperties',
  'oneOf',
  'anyOf',
  'allOf',
  'not',
]);

/** Fail when a generated schema uses JSON Schema features unavailable in OAS 3.0. */
export function assertOpenApi30Compatible(value: unknown, path = '$'): void {
  visit(value, path, 'document');
}

function visit(value: unknown, path: string, context: Context): void {
  if (Array.isArray(value)) {
    for (const [index, child] of value.entries()) {
      visit(child, `${path}[${index}]`, context === 'schema' ? 'schema' : 'document');
    }
    return;
  }
  if (!isRecord(value)) return;

  if (context === 'schema') {
    for (const unsupported of ['const', 'contains', 'prefixItems', '$schema']) {
      if (Object.hasOwn(value, unsupported)) {
        throw new Error(`OpenAPI 3.0 does not support ${unsupported} at ${path}`);
      }
    }
    if (value.type === 'null' || Array.isArray(value.type)) {
      throw new Error(`OpenAPI 3.0 requires a supported single schema type at ${path}`);
    }
    if (Array.isArray(value.items)) {
      throw new Error(`OpenAPI 3.0 requires items to be a schema object at ${path}.items`);
    }
  }

  for (const [key, child] of Object.entries(value)) {
    // These fields contain instance data, which may itself have arbitrary keys
    // named after JSON Schema keywords. They are never schema locations.
    if (context !== 'schema-map' && context !== 'property-map' && DATA_FIELDS.has(key)) continue;

    let childContext: Context = 'document';
    if (context === 'schema-map' || context === 'property-map') {
      childContext = 'schema';
    } else if (context === 'schema' && (SCHEMA_CHILDREN.has(key) || key === 'properties')) {
      childContext = key === 'properties' ? 'property-map' : 'schema';
    } else if (context === 'document' && key === 'schema') {
      childContext = 'schema';
    } else if (context === 'document' && key === 'schemas' && path.endsWith('.components')) {
      childContext = 'schema-map';
    }

    visit(child, `${path}.${key}`, childContext);
  }
}
