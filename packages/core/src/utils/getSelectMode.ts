import type { SelectMode, SelectType } from '../types/index.js';

/**
 * Determines if a select object is in 'include' or 'exclude' mode
 * - include: only specified fields are included
 * - exclude: all fields except specified are included
 */
export const getSelectMode = (select: SelectType): SelectMode => {
  for (const selectValue of Object.values(select as Record<string, unknown>)) {
    if (selectValue === false) {
      return 'exclude';
    }
    if (typeof selectValue === 'object' && selectValue !== null && !Array.isArray(selectValue)) {
      // Recursively check nested objects - if any nested object is exclude mode, return exclude
      const nestedMode = getSelectMode(selectValue as SelectType);
      if (nestedMode === 'exclude') {
        return 'exclude';
      }
      // Continue checking other keys even if this nested object is include mode
    }
  }

  return 'include';
};
