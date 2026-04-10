'use server';
import type { CustomComponent, Field, TextField } from '@revealui/core';
import { deepMerge } from '@revealui/core';
import { link } from '@/lib/fields/link';

type AdminComponents = Partial<
  Record<'Error' | 'Label' | 'Cell' | 'Field' | 'Filter', CustomComponent>
>;

type Admin = {
  components?: AdminComponents;
  upload?: {
    collections?: {
      media?: {
        fields?: Field[];
      };
    };
  };
};

const richText = (overrides: Partial<{ admin: Admin }> = {}): TextField => {
  const defaultAdminConfig: Admin = {
    upload: {
      collections: {
        media: {
          fields: [
            { type: 'richText', name: 'caption', label: 'Caption' },
            {
              type: 'radio',
              name: 'alignment',
              label: 'Alignment',
              options: [
                { label: 'Left', value: 'left' },
                { label: 'Center', value: 'center' },
                { label: 'Right', value: 'right' },
              ],
            },
            { name: 'enableLink', type: 'checkbox', label: 'Enable Link' },
            link({
              appearances: false,
              disableLabel: true,
              overrides: {
                admin: {
                  condition: (
                    _data: Record<string, unknown>,
                    siblingData: { enableLink: boolean },
                  ) => Boolean(siblingData.enableLink),
                },
              },
            }),
          ],
        },
      },
    },
    components: {
      Error: undefined, // You can provide your custom error component here if needed
      Label: undefined, // Same for label
      Cell: undefined,
      // Description removed to avoid type conflicts with RevealUI admin v3
      Field: undefined,
      Filter: undefined,
    },
  };

  const adminConfig = deepMerge(defaultAdminConfig, overrides.admin || {});

  return {
    type: 'richText',
    name: 'richText',
    required: true,
    admin: adminConfig,
  } as unknown as TextField;
};

export default richText;
