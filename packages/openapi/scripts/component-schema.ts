/** Embed a standalone JSON Schema without changing the owner of its local refs. */

const SCHEMA_MAPS = new Set([
  '$defs',
  'definitions',
  'properties',
  'patternProperties',
  'dependentSchemas',
]);
const SCHEMA_ARRAYS = new Set(['allOf', 'anyOf', 'oneOf', 'prefixItems']);
const SCHEMA_VALUES = new Set([
  'additionalProperties',
  'unevaluatedProperties',
  'propertyNames',
  'items',
  'additionalItems',
  'unevaluatedItems',
  'contains',
  'not',
  'if',
  'then',
  'else',
  'contentSchema',
]);

interface Resource {
  path: string;
  identified: boolean;
  anchors: Map<string, string>;
}

interface SchemaNode {
  schema: Record<string, unknown>;
  resource: Resource;
  path: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function pointerToken(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}

/**
 * Walk only schema-valued keywords: data in defaults/examples/extensions may
 * legitimately contain keys named $ref or $comment. Identified resources retain
 * their own reference base. External references are preserved, never fetched.
 */
export function embedComponentSchema(componentName: string, jsonSchema: unknown): unknown {
  const fail: (message: string) => never = (message) => {
    throw new Error(`Cannot emit component ${componentName}: ${message}`);
  };
  if (!/^[a-zA-Z0-9._-]+$/.test(componentName)) fail('invalid OpenAPI component name');
  const root: unknown = structuredClone(jsonSchema);
  const locations = new Set<string>();
  const nodes: SchemaNode[] = [];

  function visit(value: unknown, path: string, parent: Resource): void {
    if (typeof value !== 'boolean' && !isObject(value)) fail(`invalid schema at #${path}`);
    locations.add(path);
    if (!isObject(value)) return;
    const resource: Resource =
      typeof value.$id === 'string' ? { path, identified: true, anchors: new Map() } : parent;
    nodes.push({ schema: value, resource, path });
    if (
      typeof value.$comment === 'string' &&
      value.$comment.startsWith('JSON Schema serialization failed:')
    ) {
      fail(`serialization failure at #${path}: ${value.$comment}`);
    }
    if ('$dynamicRef' in value || '$recursiveRef' in value) {
      fail(`dynamic/recursive reference keywords at #${path} require a separate embedding policy`);
    }
    if (typeof value.$anchor === 'string') {
      if (resource.anchors.has(value.$anchor)) fail(`duplicate anchor ${value.$anchor}`);
      resource.anchors.set(value.$anchor, path);
    }
    for (const [key, child] of Object.entries(value)) {
      const childPath = `${path}/${pointerToken(key)}`;
      if (SCHEMA_MAPS.has(key) && isObject(child)) {
        for (const [name, schema] of Object.entries(child))
          visit(schema, `${childPath}/${pointerToken(name)}`, resource);
      } else if (SCHEMA_ARRAYS.has(key) && Array.isArray(child)) {
        child.forEach((schema, index) => {
          visit(schema, `${childPath}/${index}`, resource);
        });
      } else if (SCHEMA_VALUES.has(key)) {
        visit(child, childPath, resource);
      }
    }
  }

  visit(root, '', { path: '', identified: false, anchors: new Map() });
  for (const { schema, resource, path } of nodes) {
    if ('$ref' in schema && typeof schema.$ref !== 'string') fail(`invalid $ref at #${path}`);
    if (typeof schema.$ref === 'string' && schema.$ref.startsWith('#')) {
      let fragment: string;
      try {
        fragment = decodeURIComponent(schema.$ref.slice(1));
      } catch {
        fail(`invalid reference ${schema.$ref} at #${path}`);
      }
      const target =
        fragment === '' || fragment.startsWith('/')
          ? `${resource.path}${fragment}`
          : resource.anchors.get(fragment);
      if (target === undefined || !locations.has(target))
        fail(`unresolved reference ${schema.$ref} at #${path}`);
      if (!resource.identified) {
        // Encode the URI fragment after JSON Pointer escaping, preserving slashes.
        const pointer = target
          .split('/')
          .map((token) => encodeURIComponent(token).replaceAll('%24', '$'))
          .join('/');
        schema.$ref = `#/components/schemas/${componentName}${pointer}`;
      }
    }
    // Unidentified standalone anchors would collide in the shared document.
    // Their references now use pointers, so the local anchor is no longer needed.
    if (!resource.identified) Reflect.deleteProperty(schema, '$anchor');
  }
  if (isObject(root)) {
    const { $schema: _ignored, ...rest } = root;
    return rest;
  }
  return root;
}
