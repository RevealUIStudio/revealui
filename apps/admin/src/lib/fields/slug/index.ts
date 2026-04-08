import type { CheckboxField, Field, TextField } from '@revealui/core';
import { formatSlugHook } from '@/lib/fields/slug/formatSlugHook';

// Type for single field validation
type TextFieldSingleValidation = (
  value: unknown,
  options?: unknown,
) => boolean | string | Promise<boolean | string>;

type Overrides = {
  slugOverrides?: Partial<TextField>;
  checkboxOverrides?: Partial<CheckboxField>;
};

// Return type is Field[] for compatibility with collection field arrays
type Slug = (fieldToUse?: Field | string, overrides?: Overrides) => Field[];

export const slugField: Slug = (fieldToUse = 'title', overrides = {}) => {
  const { slugOverrides = {}, checkboxOverrides = {} } = overrides;

  const checkBoxField: CheckboxField = {
    name: 'slugLock',
    type: 'checkbox',
    defaultValue: true,
    admin: {
      hidden: true,
      position: 'sidebar',
    },
    ...checkboxOverrides,
  };

  const slugField: TextField = {
    name: 'slug',
    type: 'text',
    index: true,
    label: 'Slug',
    ...(slugOverrides || {}),
    hooks: {
      beforeValidate: [formatSlugHook(String(fieldToUse))],
    },
    admin: {
      position: 'sidebar',
      autoComplete: 'on',
      ...(slugOverrides?.admin || {}),
      components: {
        Field: {
          path: '@/lib/fields/slug/SlugComponent#SlugComponent',
          clientProps: {
            fieldToUse,
            checkboxFieldPath: checkBoxField.name,
          },
        },
      },
    },
    hasMany: false,
    validate: slugOverrides.validate as TextFieldSingleValidation | undefined,
    required: true, // This can be set based on your requirements
    minLength: 1, // Adjust as necessary
    maxLength: 150, // Adjust as necessary
    ...slugOverrides, // Spread any other overrides
  };

  return [slugField, checkBoxField] as Field[];
};
