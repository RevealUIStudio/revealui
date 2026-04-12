/**
 * Population Core — Pure Types & Utilities
 *
 * This module contains types and pure utility functions for relationship
 * population that have NO imports from the afterRead chain, breaking the
 * circular dependency: population → populate-helpers → afterRead → population.
 */

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

/** Location information for updating a document with populated values */
export interface UpdateLocation {
  index?: number;
  key?: string;
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

  // Prevent prototype pollution via crafted field names
  if (field.name === '__proto__' || field.name === 'constructor' || field.name === 'prototype') {
    return;
  }

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
