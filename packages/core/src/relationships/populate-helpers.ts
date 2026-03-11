/**
 * Population Helper Functions
 *
 * Extracted from the monolithic populate() function to improve
 * maintainability, testability, and clarity.
 */

import { createDataloaderCacheKey } from '../dataloader.js';
import { afterRead } from '../fields/hooks/afterRead/index.js';
import type {
  JsonObject,
  PopulateType,
  RequestContext,
  RevealRequest,
  SanitizedCollectionConfig,
  SelectType,
  TypedFallbackLocale,
} from '../types/index.js';

/** Relationship field types supported by population */
export interface PopulateRelationshipField {
  type: 'relationship' | 'upload' | 'join';
  name: string;
  relationTo?: string | string[];
  collection?: string | string[];
  hasMany?: boolean;
  maxDepth?: number;
  localized?: boolean;
}

/** Information extracted about a relationship */
export interface RelationInfo {
  /** The collection slug this relationship points to */
  relationName: string | undefined;
  /** The ID(s) to populate */
  id: unknown;
  /** The related collection config if available */
  relatedCollection: unknown;
}

/**
 * Extract relationship information from field and data
 *
 * Handles polymorphic relationships, join tables, and direct FK relationships.
 */
export function extractRelationInfo(
  field: PopulateRelationshipField,
  data: unknown,
  req: {
    revealui?: {
      collections?: Record<string, unknown>;
    };
  },
): RelationInfo {
  const dataRecord = data as Record<string, unknown>;

  // Determine relation name based on field type
  let relationName: string | undefined;
  if (field.type === 'join') {
    relationName = Array.isArray(field.collection)
      ? (dataRecord.relationTo as string)
      : (field.collection as string);
  } else {
    relationName = Array.isArray(field.relationTo)
      ? (dataRecord.relationTo as string)
      : (field.relationTo as string);
  }

  // Get related collection config
  const relatedCollection =
    relationName && req.revealui?.collections ? req.revealui.collections[relationName] : undefined;

  // Extract ID based on field configuration
  let id: unknown;
  if (field.type === 'join' && Array.isArray(field.collection)) {
    id = dataRecord.value;
  } else if (field.type !== 'join' && Array.isArray(field.relationTo)) {
    id = dataRecord.value;
  } else {
    id = data;
  }

  // Normalize ID to string or number
  if (
    typeof id !== 'string' &&
    typeof id !== 'number' &&
    typeof (id as { toString?: () => string })?.toString === 'function' &&
    typeof id !== 'object'
  ) {
    id = (id as { toString: () => string }).toString();
  }

  return { relationName, id, relatedCollection };
}

/**
 * Check if a relationship should be populated based on depth
 */
export function shouldPopulateRelationship(currentDepth: number, depth: number): boolean {
  return depth > 0 && currentDepth <= depth;
}

/**
 * Load a related document using the dataLoader
 *
 * Returns the populated document or undefined if not found.
 */
export async function loadRelatedDocument(args: {
  id: unknown;
  relationName: string;
  relatedCollection: unknown;
  currentDepth: number;
  depth: number;
  draft: boolean;
  fallbackLocale: TypedFallbackLocale;
  locale: string | null;
  overrideAccess: boolean;
  populateArg: unknown;
  showHiddenFields: boolean;
  req: {
    dataLoader?: {
      load?: (key: string) => Promise<unknown>;
    };
  };
}): Promise<unknown> {
  const {
    id,
    relationName,
    relatedCollection,
    currentDepth,
    depth,
    draft,
    fallbackLocale,
    locale,
    overrideAccess,
    populateArg,
    showHiddenFields,
    req,
  } = args;

  if (!req.dataLoader?.load) {
    return undefined;
  }

  const relatedCollectionWithConfig = relatedCollection as {
    config?: {
      slug?: string;
      fields?: unknown[];
      defaultPopulate?: unknown;
    };
    slug?: string;
    fields?: unknown[];
    defaultPopulate?: unknown;
  };

  const collectionConfig: {
    slug?: string;
    fields?: unknown[];
    defaultPopulate?: unknown;
  } = relatedCollectionWithConfig.config || relatedCollectionWithConfig;

  const collectionSlug = collectionConfig?.slug || relationName;

  // Load the document via dataLoader
  const relationshipValue = await req.dataLoader.load(
    createDataloaderCacheKey({
      collectionSlug: String(collectionSlug),
      currentDepth: currentDepth + 1,
      depth,
      docID: id as string,
      draft,
      fallbackLocale,
      locale: locale || 'en',
      overrideAccess,
      populate: (populateArg as PopulateType) || undefined,
      select:
        populateArg && typeof populateArg === 'object'
          ? (((populateArg as Record<string, unknown>)[String(collectionSlug)] ??
              collectionConfig?.defaultPopulate) as SelectType | undefined)
          : (collectionConfig?.defaultPopulate as SelectType | undefined),
      showHiddenFields,
      transactionID: '',
    }),
  );

  return relationshipValue;
}

/**
 * Recursively populate nested relationships on a document
 *
 * Applies afterRead hook to populate relationships within the document.
 */
export async function applyNestedPopulation(args: {
  doc: unknown;
  collectionConfig: {
    slug?: string;
    fields?: unknown[];
    defaultPopulate?: unknown;
  };
  currentDepth: number;
  depth: number;
  draft: boolean;
  fallbackLocale: TypedFallbackLocale;
  locale: string | null;
  overrideAccess: boolean;
  populateArg: unknown;
  showHiddenFields: boolean;
  req: RevealRequest;
}): Promise<unknown> {
  const {
    doc,
    collectionConfig,
    currentDepth,
    depth,
    draft,
    fallbackLocale,
    locale,
    overrideAccess,
    populateArg,
    showHiddenFields,
    req,
  } = args;

  if (!doc || currentDepth >= depth) {
    return doc;
  }

  const sanitizedConfig = {
    ...collectionConfig,
    flattenedFields: collectionConfig?.fields,
    customIDType: 'text',
    trash: false,
    defaultPopulate: [],
  } as SanitizedCollectionConfig;

  const localeForAfterRead = locale ?? 'en';

  return await afterRead({
    collection: sanitizedConfig,
    context: {} as RequestContext,
    currentDepth: currentDepth + 1,
    depth,
    doc: doc as JsonObject,
    draft,
    fallbackLocale,
    findMany: false,
    flattenLocales: true,
    global: null,
    locale: localeForAfterRead,
    overrideAccess,
    populate: (populateArg as PopulateType) || undefined,
    req,
    select: undefined,
    showHiddenFields,
  });
}

/**
 * Location information for updating a document with populated values
 */
export interface UpdateLocation {
  index?: number;
  key?: string;
}

/**
 * Update document with populated relationship value
 *
 * Handles various field configurations: arrays, localized fields, join tables, etc.
 */
export function updateDocumentWithPopulatedValue(args: {
  dataReference: Record<string, unknown>;
  field: PopulateRelationshipField;
  relationshipValue: unknown;
  location: UpdateLocation;
}): void {
  const { dataReference, field, relationshipValue, location } = args;
  const { index, key } = location;

  // Case 1: Localized array field (has both index and key)
  if (typeof index === 'number' && typeof key === 'string') {
    const fieldRecord = dataReference[field.name] as Record<string, unknown>;
    const localeRecords = fieldRecord[key] as Array<Record<string, unknown>>;
    const localeEntry = localeRecords[index] as Record<string, unknown>;

    if (field.type !== 'join' && Array.isArray(field.relationTo)) {
      localeEntry.value = relationshipValue;
    } else if (field.type === 'join' && Array.isArray(field.collection)) {
      localeEntry.value = relationshipValue;
    } else {
      localeRecords[index] = relationshipValue as Record<string, unknown>;
    }
    return;
  }

  // Case 2: Array field or localized field (has index or key, but not both)
  if (typeof index === 'number' || typeof key === 'string') {
    const fieldRecord = dataReference[field.name] as Record<string, unknown>;
    const target = (index ?? key) as number | string;

    if (field.type === 'join') {
      if (!Array.isArray(field.collection)) {
        const docs = fieldRecord.docs as Array<Record<string, unknown>>;
        docs[target as number] = relationshipValue as Record<string, unknown>;
      } else {
        const docs = fieldRecord.docs as Array<Record<string, unknown>>;
        const docEntry = docs[target as number] as Record<string, unknown>;
        docEntry.value = relationshipValue;
      }
    } else if (Array.isArray(field.relationTo)) {
      const entries = fieldRecord as unknown as Array<Record<string, unknown>>;
      const entry = entries[target as number] as Record<string, unknown>;
      entry.value = relationshipValue;
    } else {
      fieldRecord[target as string] = relationshipValue;
    }
    return;
  }

  // Case 3: Single value (no index or key)
  if (field.type !== 'join' && Array.isArray(field.relationTo)) {
    const fieldRecord = dataReference[field.name] as Record<string, unknown>;
    fieldRecord.value = relationshipValue;
  } else if (field.type === 'join' && Array.isArray(field.collection)) {
    const fieldRecord = dataReference[field.name] as Record<string, unknown>;
    fieldRecord.value = relationshipValue;
  } else {
    dataReference[field.name] = relationshipValue;
  }
}
