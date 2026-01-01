/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FormFieldBlock } from "revealui/cms/plugins";

export const buildInitialFormState = (fields: FormFieldBlock[]) => {
  return fields?.reduce(
    (initialSchema, field) => {
      switch (field.blockType) {
        case "checkbox":
          return {
            ...initialSchema,
            [field.name]: field.defaultValue,
          };
        case "country":
        case "email":
        case "text":
        case "select":
        case "state":
          return {
            ...initialSchema,
            [field.name]: "", // Set default empty value for these types
          };
        default:
          return initialSchema; // Return initialSchema if no conditions match
      }
    },
    {} as Record<string, any>,
  ); // Cast initial value to a record type
};

// import type { FormFieldBlock } from "revealui/cms/plugins";

// export const buildInitialFormState = (fields: FormFieldBlock[]) => {
//   return fields?.reduce((initialSchema, field) => {
//     if (field.blockType === "checkbox") {
//       return {
//         ...initialSchema,
//         [field.name]: field.defaultValue,
//       };
//     }
//     if (field.blockType === "country") {
//       return {
//         ...initialSchema,
//         [field.name]: "",
//       };
//     }
//     if (field.blockType === "email") {
//       return {
//         ...initialSchema,
//         [field.name]: "",
//       };
//     }
//     if (field.blockType === "text") {
//       return {
//         ...initialSchema,
//         [field.name]: "",
//       };
//     }
//     if (field.blockType === "select") {
//       return {
//         ...initialSchema,
//         [field.name]: "",
//       };
//     }
//     if (field.blockType === "state") {
//       return {
//         ...initialSchema,
//         [field.name]: "",
//       };
//     }
//   }, {});
// };
