// External type imports

import {
  type Field,
  fieldHasMaxDepth,
  fieldShouldBeLocalized,
  fieldSupportsMany,
} from '../fields/config/types.js';
import type { PopulateType, RevealRequest, TypedFallbackLocale } from '../types/index.js';
import type { PopulateRelationshipField } from './populate-core.js';
// Pure utilities from populate-core (no circular dependency)
import {
  extractRelationInfo,
  shouldPopulateRelationship,
  updateDocumentWithPopulatedValue,
} from './populate-core.js';
// Helpers that depend on afterRead (static import  -  safe because populate-core
// broke the cycle: population no longer imports from populate-helpers for the
// functions that afterRead/promise.ts needs)
import { applyNestedPopulation, loadRelatedDocument } from './populate-helpers.js';

// Request type for population
interface PopulateRequest {
  revealui?: {
    collections?: Record<string, { config?: { defaultPopulate?: unknown } }>;
    config?: { collections?: unknown[] };
  };
  dataLoader?: {
    load?: (key: string) => Promise<unknown>;
    find?: (options: unknown) => Promise<unknown>;
  };
}

type PopulateArgs = {
  currentDepth: number;
  data: unknown;
  dataReference: Record<string, unknown>;
  depth: number;
  draft: boolean;
  fallbackLocale: TypedFallbackLocale;
  field: PopulateRelationshipField;
  index?: number;
  key?: string;
  locale: null | string;
  overrideAccess: boolean;
  populateArg?: PopulateType;
  req: PopulateRequest;
  showHiddenFields: boolean;
};

/**
 * Populate a single relationship field
 *
 * Refactored from the original monolithic function for better maintainability.
 * Uses helper functions from populate-core.ts and populate-helpers.ts.
 */
const populate = async ({
  currentDepth,
  data,
  dataReference,
  depth,
  draft,
  fallbackLocale,
  field,
  index,
  key,
  locale,
  overrideAccess,
  populateArg,
  req,
  showHiddenFields,
}: PopulateArgs) => {
  // Step 1: Extract relationship information
  const { relationName, id, relatedCollection } = extractRelationInfo(field, data, req);

  if (!relatedCollection) {
    return; // No collection to populate from
  }

  // Step 2: Check if we should populate
  let relationshipValue: unknown;
  if (shouldPopulateRelationship(currentDepth, depth) && req.dataLoader?.load) {
    const collectionConfig: {
      slug?: string;
      fields?: unknown[];
      defaultPopulate?: unknown;
    } =
      (
        relatedCollection as {
          config?: {
            slug?: string;
            fields?: unknown[];
            defaultPopulate?: unknown;
          };
        }
      ).config || relatedCollection;

    // Step 3: Load the related document
    relationshipValue = await loadRelatedDocument({
      id,
      relationName: relationName || collectionConfig.slug || '',
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
    });

    // Step 4: Recursively populate nested relationships
    if (relationshipValue && currentDepth < depth) {
      relationshipValue = await applyNestedPopulation({
        doc: relationshipValue,
        collectionConfig,
        currentDepth,
        depth,
        draft,
        fallbackLocale,
        locale,
        overrideAccess,
        populateArg,
        showHiddenFields,
        req: req as RevealRequest,
      });
    }
  }

  // Step 5: Fall back to ID if no value loaded
  if (!relationshipValue) {
    relationshipValue = id;
  }

  // Step 6: Update the document with the populated value
  updateDocumentWithPopulatedValue({
    dataReference,
    field,
    relationshipValue,
    location: { index, key },
  });
};

type PromiseArgs = {
  currentDepth: number;
  depth: number;
  draft: boolean;
  fallbackLocale: TypedFallbackLocale;
  field: PopulateRelationshipField;
  locale: null | string;
  overrideAccess: boolean;
  populate?: PopulateType;
  req: PopulateRequest;
  showHiddenFields: boolean;
  siblingDoc: Record<string, unknown>;
};

export const relationshipPopulationPromise = async ({
  currentDepth,
  depth,
  draft,
  fallbackLocale,
  field,
  locale,
  overrideAccess,
  populate: populateArg,
  req,
  showHiddenFields,
  siblingDoc,
}: PromiseArgs): Promise<void> => {
  const resultingDoc = siblingDoc;
  const fieldForChecks = field as Field;
  const maxDepth = fieldHasMaxDepth(fieldForChecks) ? field.maxDepth : undefined;
  const populateDepth = maxDepth !== undefined && maxDepth < depth ? maxDepth : depth;
  const rowPromises: Promise<void>[] = [];
  const siblingFieldValue = siblingDoc[field.name];
  const siblingFieldRecord =
    typeof siblingFieldValue === 'object' && siblingFieldValue !== null
      ? (siblingFieldValue as Record<string, unknown>)
      : null;

  if (field.type === 'join' || (fieldSupportsMany(fieldForChecks) && field.hasMany)) {
    if (
      fieldShouldBeLocalized({ field: fieldForChecks, parentIsLocalized: false }) &&
      locale === 'all' &&
      siblingFieldRecord
    ) {
      Object.keys(siblingFieldRecord).forEach((localeKey) => {
        const localeValue = siblingFieldRecord[localeKey];
        if (Array.isArray(localeValue)) {
          const localeValues = localeValue as unknown[];
          localeValues.forEach((_, index) => {
            const rowPromise = async () => {
              await populate({
                currentDepth,
                data: localeValues[index],
                dataReference: resultingDoc,
                depth: populateDepth,
                draft,
                fallbackLocale,
                field,
                index,
                key: localeKey,
                locale,
                overrideAccess,
                populateArg: populateArg || undefined,
                req,
                showHiddenFields,
              });
            };
            rowPromises.push(rowPromise());
          });
        }
      });
    } else if (
      Array.isArray(siblingFieldValue) ||
      Array.isArray(siblingFieldRecord?.docs) ||
      Array.isArray(siblingDoc[`${field.name}_ids`])
    ) {
      const docsValue = siblingFieldRecord?.docs;
      const idsValue = siblingDoc[`${field.name}_ids`];
      const relationshipArray = Array.isArray(siblingFieldValue)
        ? (siblingFieldValue as unknown[])
        : Array.isArray(docsValue)
          ? (docsValue as unknown[])
          : (idsValue as unknown[]);

      relationshipArray.forEach((relatedDoc, index) => {
        const rowPromise = async () => {
          if (relatedDoc) {
            const relatedDocRecord =
              typeof relatedDoc === 'object' && relatedDoc !== null
                ? (relatedDoc as Record<string, unknown>)
                : null;
            const relatedId = relatedDocRecord?.id;
            await populate({
              currentDepth,
              data:
                !(field.type === 'join' && Array.isArray(field.collection)) && relatedId
                  ? relatedId
                  : relatedDoc,
              dataReference: resultingDoc,
              depth: populateDepth,
              draft,
              fallbackLocale,
              field,
              index,
              locale,
              overrideAccess,
              populateArg: populateArg || undefined,
              req,
              showHiddenFields,
            });
          }
        };

        rowPromises.push(rowPromise());
      });
    }
  } else if (field.localized && locale === 'all' && siblingFieldRecord) {
    Object.keys(siblingFieldRecord).forEach((localeKey) => {
      const rowPromise = async () => {
        await populate({
          currentDepth,
          data: siblingFieldRecord[localeKey],
          dataReference: resultingDoc,
          depth: populateDepth,
          draft,
          fallbackLocale,
          field,
          key: localeKey,
          locale,
          overrideAccess,
          populateArg: populateArg || undefined,
          req,
          showHiddenFields,
        });
      };
      rowPromises.push(rowPromise());
    });

    await Promise.all(rowPromises);
  } else if (siblingFieldValue || siblingDoc[`${field.name}_id`]) {
    // For relationships, the data might be in the FK column
    const relationshipData = siblingFieldValue || siblingDoc[`${field.name}_id`];
    await populate({
      currentDepth,
      data: relationshipData,
      dataReference: resultingDoc,
      depth: populateDepth,
      draft,
      fallbackLocale,
      field,
      locale,
      overrideAccess,
      populateArg: populateArg || undefined,
      req,
      showHiddenFields,
    });
  }
  await Promise.all(rowPromises);
};
