import type { Field, SelectType } from '../types/index.js';
/**
 * Strips unselected fields from a document based on select configuration
 */
export declare const stripUnselectedFields: ({ field, select, siblingDoc, }: {
    field: Field;
    select: SelectType;
    siblingDoc: Record<string, unknown>;
}) => void;
//# sourceMappingURL=stripUnselectedFields.d.ts.map