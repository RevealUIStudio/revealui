import type { Plugin, RevealRequest, Document } from '../types/index';

export interface NestedDocsPluginConfig {
  collections?: string[];
  parentFieldSlug?: string;
  breadcrumbsFieldSlug?: string;
}

export function nestedDocsPlugin(config: NestedDocsPluginConfig = {}): Plugin {
  const {
    collections = [],
    parentFieldSlug = 'parent',
    breadcrumbsFieldSlug = 'breadcrumbs'
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

          // Add hooks for breadcrumbs
          collection.hooks = {
            ...collection.hooks,
            beforeChange: [
              ...(collection.hooks?.beforeChange || []),
              async ({ data, req }: { data: Partial<Document>; req: RevealRequest }) => {
                // Generate breadcrumbs based on parent
                if (data[parentFieldSlug]) {
                  // This would need to be implemented with actual database queries
                  data[breadcrumbsFieldSlug] = [];
                }
                return data;
              },
            ],
          };

          collection.fields = [
            ...collection.fields,
            parentField,
            breadcrumbsField,
          ];
        }
      }
    }

    return incomingConfig;
  };
}

