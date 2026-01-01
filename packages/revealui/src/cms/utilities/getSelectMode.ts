import type { SelectType, SelectMode } from '../types/index.js';

/**
 * Determines if a select object is in 'include' or 'exclude' mode
 * - include: only specified fields are included
 * - exclude: all fields except specified are included
 */
export const getSelectMode = (select: SelectType): SelectMode => {
  for (const key in select) {
    const selectValue = select[key];
    if (selectValue === false) {
      return 'exclude';
    }
    if (typeof selectValue === 'object' && selectValue !== null) {
      return getSelectMode(selectValue);
    }
  }

  return 'include';
};