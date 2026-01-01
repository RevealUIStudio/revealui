import type { Plugin, Field, PayloadRequest } from '../types/index';

export interface RedirectsPluginConfig {
  collections?: string[];
  overrides?: {
    fields?: (args: { defaultFields: Field[] }) => Field[];
    hooks?: {
      afterChange?: ((args: { doc: Document; req: PayloadRequest }) => Promise<Document> | Document)[];
    };
  };
}

export function redirectsPlugin(config: RedirectsPluginConfig = {}): Plugin {
  const { collections = ['pages', 'posts'] } = config;

  return (incomingConfig) => {
    // Add redirects collection
    const redirectsCollection = {
      slug: 'redirects',
      admin: {
        useAsTitle: 'from',
        defaultColumns: ['from', 'to', 'status'],
      },
      fields: [
        {
          name: 'from',
          type: 'text' as const,
          required: true,
          unique: true,
          admin: {
            description: 'The URL to redirect from',
          },
        },
        {
          name: 'to',
          type: 'relationship' as const,
          relationTo: collections,
          required: true,
          maxDepth: 1,
          admin: {
            description: 'The page or post to redirect to',
          },
        },
        {
          name: 'status',
          type: 'select' as const,
          required: true,
          defaultValue: 301,
          options: [
            { label: '301 - Permanent', value: 301 },
            { label: '302 - Temporary', value: 302 },
          ],
        },
      ],
    };

    // Apply overrides if provided
    if (config.overrides?.fields) {
      redirectsCollection.fields = config.overrides.fields({
        defaultFields: redirectsCollection.fields
      });
    }

    if (config.overrides?.hooks?.afterChange) {
      redirectsCollection.hooks = {
        ...redirectsCollection.hooks,
        afterChange: config.overrides.hooks.afterChange,
      };
    }

    incomingConfig.collections = [
      ...(incomingConfig.collections || []),
      redirectsCollection,
    ];

    return incomingConfig;
  };
}

