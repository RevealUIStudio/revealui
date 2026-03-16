/**
 * Population Helper Functions
 *
 * Extracted from the monolithic populate() function to improve
 * maintainability, testability, and clarity.
 *
 * Pure types and utilities live in populate-core.ts (no afterRead imports).
 * This module re-exports them and adds helpers that depend on afterRead.
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

// Re-export pure types and utilities from populate-core
export type { PopulateRelationshipField, RelationInfo, UpdateLocation } from './populate-core.js';
export {
  extractRelationInfo,
  shouldPopulateRelationship,
  updateDocumentWithPopulatedValue,
} from './populate-core.js';

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
