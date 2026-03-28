import type { Plugin } from '../types/index.js';

export interface NestedDocsPluginConfig {
  collections?: string[];
  parentFieldSlug?: string;
  breadcrumbsFieldSlug?: string;
  /** Drizzle DB client getter — if not provided, breadcrumbs will be empty */
  getDb?: () => unknown;
  /** Label field to use for breadcrumb labels (defaults to 'title') */
  labelField?: string;
}

interface BreadcrumbEntry {
  doc: string;
  url: string;
  label: string;
}

/**
 * Walk up the parent chain to build breadcrumbs.
 * Uses raw SQL via the Drizzle client to query the same collection table.
 */
async function buildBreadcrumbs(
  db: unknown,
  collectionSlug: string,
  parentId: string,
  parentFieldSlug: string,
  labelField: string,
  maxDepth = 10,
): Promise<BreadcrumbEntry[]> {
  const crumbs: BreadcrumbEntry[] = [];
  let currentId: string | null = parentId;
  let depth = 0;

  // Validate identifiers to prevent SQL injection (table/column names are from config, not user input)
  const identifierPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
  const identifiersValid =
    identifierPattern.test(collectionSlug) &&
    identifierPattern.test(labelField) &&
    identifierPattern.test(parentFieldSlug);
  if (!identifiersValid) {
    return crumbs;
  }

  while (currentId && depth < maxDepth) {
    try {
      // Use parameterized query — $1 is the only user-controlled value
      const result = await (
        db as { execute: (sql: unknown) => Promise<{ rows: Record<string, unknown>[] }> }
      ).execute({
        sql: `SELECT id, "${labelField}", "${parentFieldSlug}" FROM "${collectionSlug}" WHERE id = $1 LIMIT 1`,
        params: [currentId],
        // biome-ignore lint/suspicious/noExplicitAny: Drizzle sql template requires any for raw parameterized queries
      } as any);

      const row = result?.rows?.[0];
      if (!row) break;

      crumbs.unshift({
        doc: String(row.id),
        url: `/${collectionSlug}/${String(row.id)}`,
        label: String(row[labelField] ?? row.id),
      });

      currentId = row[parentFieldSlug] ? String(row[parentFieldSlug]) : null;
    } catch {
      break;
    }
    depth++;
  }

  return crumbs;
}

export function nestedDocsPlugin(config: NestedDocsPluginConfig = {}): Plugin {
  const {
    collections = [],
    parentFieldSlug = 'parent',
    breadcrumbsFieldSlug = 'breadcrumbs',
    getDb,
    labelField = 'title',
  } = config;

  return (incomingConfig) => {
    if (incomingConfig.collections) {
      for (const collection of incomingConfig.collections) {
        if (collections.includes(collection.slug)) {
          // Add parent field
          const parentField = {
            name: parentFieldSlug,
            type: 'relationship' as const,
            relationTo: collection.slug,
            maxDepth: 1,
            admin: {
              position: 'sidebar',
            },
          };

          // Add breadcrumbs field
          const breadcrumbsField = {
            name: breadcrumbsFieldSlug,
            type: 'array' as const,
            admin: {
              readOnly: true,
              components: {
                RowLabel: () => null,
              },
            },
            fields: [
              {
                name: 'doc',
                type: 'relationship' as const,
                relationTo: collection.slug,
                maxDepth: 1,
              },
              {
                name: 'url',
                type: 'text' as const,
              },
              {
                name: 'label',
                type: 'text' as const,
              },
            ],
          };

          const collectionSlug = collection.slug;

          // Add hooks for breadcrumbs
          const beforeChangeHook = async ({ data }: { data: Record<string, unknown> }) => {
            const parentId = data[parentFieldSlug];
            if (parentId && getDb) {
              const db = getDb();
              data[breadcrumbsFieldSlug] = await buildBreadcrumbs(
                db,
                collectionSlug,
                String(parentId),
                parentFieldSlug,
                labelField,
              );
            } else {
              data[breadcrumbsFieldSlug] = [];
            }
            return data;
          };

          collection.hooks = {
            ...collection.hooks,
            beforeChange: [
              ...(collection.hooks?.beforeChange || []),
              beforeChangeHook as unknown as NonNullable<
                typeof collection.hooks
              >['beforeChange'] extends Array<infer T>
                ? T
                : never,
            ],
          };

          collection.fields = [...collection.fields, parentField, breadcrumbsField];
        }
      }
    }

    return incomingConfig;
  };
}
