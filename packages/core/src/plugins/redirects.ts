import type { CollectionConfig, Field, Plugin, RevealRequest } from '../types/index.js';

export interface RedirectsPluginConfig {
  collections?: string[];
  overrides?: {
    fields?: (args: { defaultFields: Field[] }) => Field[];
    hooks?: {
      afterChange?: ((args: {
        doc: Document;
        req: RevealRequest;
      }) => Promise<Document> | Document)[];
    };
  };
}

export function redirectsPlugin(config: RedirectsPluginConfig = {}): Plugin {
  const { collections = ['pages', 'posts'] } = config;

  return (incomingConfig) => {
    // Add redirects collection
    const redirectsCollection: CollectionConfig = {
      slug: 'redirects',
      admin: {
        useAsTitle: 'from',
        defaultColumns: ['from', 'to', 'status'],
      },
      fields: [
        {
          name: 'from',
          type: 'text',
          required: true,
          unique: true,
          admin: {
            description: 'The URL to redirect from',
          },
        },
        {
          name: 'to',
          type: 'relationship',
          relationTo: collections,
          required: true,
          maxDepth: 1,
          admin: {
            description: 'The page or post to redirect to',
          },
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          defaultValue: '301',
          options: [
            { label: '301 - Permanent', value: '301' },
            { label: '302 - Temporary', value: '302' },
          ],
        },
      ],
    };

    // Apply overrides if provided
    if (config.overrides?.fields) {
      redirectsCollection.fields = config.overrides.fields({
        defaultFields: redirectsCollection.fields,
      });
    }

    if (config.overrides?.hooks?.afterChange) {
      redirectsCollection.hooks = {
        ...redirectsCollection.hooks,
        afterChange: config.overrides.hooks.afterChange as CollectionConfig['hooks'] extends {
          afterChange?: infer T;
        }
          ? T
          : never,
      };
    }

    incomingConfig.collections = [
      ...(incomingConfig.collections || []),
      // biome-ignore lint/suspicious/noExplicitAny: invariant generic needs any for heterogeneous array
      redirectsCollection as CollectionConfig<any>,
    ];

    return incomingConfig;
  };
}
