import type { SelectType } from '../types/index.js';
/**
 * Gets the select configuration for a specific block
 */
export declare const getBlockSelect: ({ block, select, selectMode, }: {
    block: {
        slug: string;
    };
    select: SelectType;
    selectMode: "include" | "exclude";
}) => SelectType | undefined;
//# sourceMappingURL=getBlockSelect.d.ts.map