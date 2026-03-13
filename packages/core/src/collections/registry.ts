import type { RevealCollectionConfig, RevealUIField } from '../types/index.js';
import { flattenFields, isJsonFieldType } from '../utils/type-guards.js';

export type CollectionStorageMode = 'dynamic' | 'typed-candidate';

export interface CollectionStorageDescriptor {
  slug: string;
  tableName: string;
  storageMode: CollectionStorageMode;
  allowedColumns: string[];
  jsonFieldNames: string[];
}

const TYPED_CANDIDATE_SLUGS = new Set(['sites', 'pages', 'posts', 'media', 'users']);

export function buildCollectionStorageDescriptor(
  collection: RevealCollectionConfig,
): CollectionStorageDescriptor {
  const flattenedFields = flattenFields(collection.fields || []);
  const allowedColumns = new Set<string>([
    'id',
    'createdAt',
    'updatedAt',
    'created_at',
    'updated_at',
    '_json',
    'password',
  ]);
  const jsonFieldNames = new Set<string>();

  for (const field of flattenedFields as RevealUIField[]) {
    if (!field.name) continue;
    if (isJsonFieldType(field)) {
      jsonFieldNames.add(field.name);
      continue;
    }
    allowedColumns.add(field.name);
  }

  return {
    slug: collection.slug,
    tableName: collection.slug,
    storageMode: TYPED_CANDIDATE_SLUGS.has(collection.slug) ? 'typed-candidate' : 'dynamic',
    allowedColumns: [...allowedColumns],
    jsonFieldNames: [...jsonFieldNames],
  };
}

export function buildCollectionStorageRegistry(
  collections: RevealCollectionConfig[] | undefined,
): Record<string, CollectionStorageDescriptor> {
  const registry: Record<string, CollectionStorageDescriptor> = {};
  for (const collection of collections || []) {
    registry[collection.slug] = buildCollectionStorageDescriptor(collection);
  }
  return registry;
}
