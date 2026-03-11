import type { FormFieldBlock } from '@revealui/core/plugins';
import type { FormData, FormFieldValue } from './Component';

export const buildInitialFormState = (fields: FormFieldBlock[] | undefined): FormData => {
  if (!fields || fields.length === 0) {
    return {};
  }

  return fields.reduce<FormData>((initialSchema, field) => {
    let defaultValue: FormFieldValue = '';

    switch (field.blockType) {
      case 'checkbox':
        defaultValue = typeof field.defaultValue === 'boolean' ? field.defaultValue : false;
        break;
      case 'number':
        defaultValue =
          typeof field.defaultValue === 'number'
            ? field.defaultValue
            : typeof field.defaultValue === 'string'
              ? parseFloat(field.defaultValue) || 0
              : 0;
        break;
      case 'country':
      case 'email':
      case 'text':
      case 'select':
      case 'state':
      case 'textarea':
        defaultValue = typeof field.defaultValue === 'string' ? field.defaultValue : '';
        break;
      default:
        defaultValue =
          typeof field.defaultValue === 'string'
            ? field.defaultValue
            : typeof field.defaultValue === 'number'
              ? field.defaultValue
              : typeof field.defaultValue === 'boolean'
                ? field.defaultValue
                : '';
    }

    initialSchema[field.name] = defaultValue;
    return initialSchema;
  }, {});
};
