import type { RevealUIField } from '../../types/index.js';
/**
 * Field configuration types for RevealUI
 */
export type Field = RevealUIField;
export type RelationshipField = RevealUIField & {
    type: 'relationship';
    relationTo: string | string[];
    hasMany?: boolean;
    maxDepth?: number;
    localized?: boolean;
};
export type UploadField = RevealUIField & {
    type: 'upload';
    relationTo: string;
};
export type JoinField = RevealUIField & {
    type: 'join';
    collection: string | string[];
    on?: string;
};
export type TabAsField = RevealUIField & {
    type: 'tabs';
    tabs: Array<{
        name: string;
        fields: Field[];
    }>;
};
export type Block = {
    slug: string;
    fields: Field[];
};
/**
 * Utility functions for field types
 */
export declare const fieldHasMaxDepth: (field: Field) => field is Field & {
    maxDepth: number;
};
export declare const fieldShouldBeLocalized: ({ field, parentIsLocalized, }: {
    field: Field;
    parentIsLocalized?: boolean;
}) => boolean;
export declare const fieldSupportsMany: (field: Field) => field is Field & {
    hasMany: boolean;
};
export declare const fieldAffectsData: (field: Field) => boolean;
export declare const tabHasName: (tab: TabAsField) => boolean;
//# sourceMappingURL=types.d.ts.map