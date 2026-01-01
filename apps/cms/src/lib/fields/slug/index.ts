import {formatSlugHook} from "@/lib/fields/slug/formatSlugHook";
import type {
  CheckboxField,
  Field,
  TextField,
  TextFieldSingleValidation,
} from "revealui/cms";

type Overrides = {
  slugOverrides?: Partial<TextField>;
  checkboxOverrides?: Partial<CheckboxField>;
};

type Slug = (
  fieldToUse?: Field | string,
  overrides?: Overrides,
) => [TextField, CheckboxField];

export const slugField: Slug = (fieldToUse = "title", overrides = {}) => {
  const { slugOverrides = {}, checkboxOverrides = {} } = overrides;

  const checkBoxField: CheckboxField = {
    name: "slugLock",
    type: "checkbox",
    defaultValue: true,
    admin: {
      hidden: true,
      position: "sidebar",
    },
    ...checkboxOverrides,
  };

  // @ts-expect-error   Expect ts error here because of typescript mismatching Partial<TextField> with TextField
  const slugField: TextField = {
    name: "slug",
    type: "text",
    index: true,
    label: "Slug",
    ...(slugOverrides || {}),
    hooks: {
      beforeValidate: [formatSlugHook(String(fieldToUse))],
    },
    admin: {
      position: "sidebar",
      autoComplete: "on",
      ...(slugOverrides || {}),
      components: {
        Field: {
          path: "@/lib/fields/slug/SlugComponent#SlugComponent",
          clientProps: {
            fieldToUse,
            checkboxFieldPath: checkBoxField.name,
          },
        },
      },
      // Make sure other properties align with expected type
    },
    hasMany: false,
    validate: slugOverrides.validate as TextFieldSingleValidation | undefined,
    required: true, // This can be set based on your requirements
    minLength: 1, // Adjust as necessary
    maxLength: 150, // Adjust as necessary
    ...slugOverrides, // Spread any other overrides
  };

  return [slugField, checkBoxField];
};

// import { TextField } from "revealui/cms";

// import { formatSlugHook } from "./formatSlugHook";

// type Overrides = {
//   slugOverrides?: Partial<TextField>;
//   checkboxOverrides?: Partial<CheckboxField>;
// };

// type Slug = (
//   fieldToUse?: Field | string,
//   overrides?: Overrides,
// ) => [Partial<TextField> | TextField, Partial<CheckboxField> | CheckboxField];

// export const slugField: Slug = (fieldToUse = "title", overrides = {}) => {
//   const { slugOverrides, checkboxOverrides } = overrides;

//   const checkBoxField: CheckboxField = {
//     name: "slugLock",
//     type: "checkbox",
//     defaultValue: true,
//     admin: {
//       hidden: true,
//       position: "sidebar",
//     },
//     ...checkboxOverrides,
//   };

//   const slugField: Partial<TextField> = {
//     name: "slug",
//     type: "text",
//     index: true,
//     label: "Slug",
//     ...(slugOverrides || {}),
//     hooks: {
//       // Kept this in for hook or API based updates
//       beforeValidate: [formatSlugHook(String(fieldToUse))],
//     },
//     admin: {
//       position: "sidebar",
//       ...(slugOverrides?.admin || {}),
//       components: {
//         Field: {
//           path: "@/lib/fields/slug/SlugComponent#SlugComponent",
//           clientProps: {
//             fieldToUse,
//             checkboxFieldPath: checkBoxField.name,
//           },
//         },
//       },
//     },
//   };

//   return [slugField, checkBoxField];
// };
