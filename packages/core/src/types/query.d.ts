/**
 * RevealUI Query System Types
 *
 * Defines the query operators, values, and where clause types
 * used throughout the RevealUI framework.
 *
 * @module @revealui/core/types/query
 */
/** RevealUI's operator system for queries */
export declare const RevealOperators: readonly ["equals", "contains", "not_equals", "in", "not_in", "exists", "greater_than", "less_than", "like", "near"];
export type RevealOperator = (typeof RevealOperators)[number];
/** RevealUI's value system - supports common types and nested structures */
export type RevealValue = string | number | boolean | null | Date | RevealValue[] | {
    [key: string]: RevealValue;
};
export type RevealDataObject = {
    [key: string]: RevealValue;
};
/** Single field where condition */
export type RevealWhereField = {
    [K in RevealOperator]?: RevealValue;
};
/** Complete where clause with and/or support */
export type RevealWhere = {
    [key: string]: RevealWhereField;
} | {
    and: RevealWhere[];
} | {
    or: RevealWhere[];
} | {
    and: RevealWhere[];
    or: RevealWhere[];
};
export type RevealSort = string | string[];
export type RevealSelect = string[] | {
    [key: string]: boolean | RevealSelect;
};
/** RevealUI's document model */
export interface RevealDocument {
    id: string | number;
    [key: string]: RevealValue | undefined;
}
export interface RevealDocumentWithMeta extends RevealDocument {
    createdAt?: string;
    updatedAt?: string;
    _status?: 'draft' | 'published';
}
/** Generic document type with ID */
export type TypeWithID = RevealDocument;
/** Populate configuration */
export type PopulateType = Record<string, string[] | boolean> | boolean;
/** Select configuration */
export type SelectType = Record<string, boolean | Record<string, boolean>> | string[];
/** JSON object type */
export type JsonObject = Record<string, unknown>;
/** Where clause alias for CMS compatibility */
export type WhereClause = Record<string, unknown>;
/**
 * Typed fallback locale configuration
 * Used for localization fallback chains
 */
export type TypedFallbackLocale = string | false | null;
/**
 * Select mode for population control
 * - 'include': Include only specified fields
 * - 'exclude': Exclude specified fields
 */
export type SelectMode = 'include' | 'exclude';
/**
 * Metadata about a relationship field
 * Used for relationship population and analysis
 */
export interface RelationshipMetadata {
    /** The path/name of this field in the collection */
    path?: string;
    /** The field name in the collection */
    fieldName?: string;
    /** The collection(s) this field relates to */
    relationTo: string | string[];
    /** Whether this field has many relations */
    hasMany?: boolean;
    /** Max depth for population */
    maxDepth?: number;
    /** Whether the field is localized */
    localized?: boolean;
    /** How this relationship is stored in the database */
    storageType?: 'direct_fk' | 'junction_table' | 'polymorphic';
    /** Foreign key column name */
    fkColumnName?: string;
    /** Table name for junction tables */
    tableName?: string;
    /** The name of the field in the collection */
    collection?: string;
    /** Field depth in nested structure */
    depth?: number;
}
/** Document type alias for CMS compatibility */
export type Document = RevealDocument;
//# sourceMappingURL=query.d.ts.map