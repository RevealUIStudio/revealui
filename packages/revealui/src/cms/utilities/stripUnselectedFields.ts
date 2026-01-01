import type { Field, SelectType } from '../types/index.js';

/**
 * Strips unselected fields from a document based on select configuration
 */
export const stripUnselectedFields = ({
  field,
  select,
  siblingDoc,
}: {
  field: Field;
  select: SelectType;
  siblingDoc: Record<string, unknown>;
}): void => {
  if (!select || typeof select !== 'object') return;

  for (const key of Object.keys(siblingDoc[field.name] as Record<string, unknown> || {})) {
    if (!(key in select)) {
      delete (siblingDoc[field.name] as Record<string, unknown>)[key];
    }
  }
};