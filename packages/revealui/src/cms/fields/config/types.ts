import type { RevealField } from '../../types/index.js';

/**
 * Field configuration types for RevealUI
 */

export type Field = RevealField;

export type RelationshipField = RevealField & {
  type: 'relationship';
  relationTo: string | string[];
  hasMany?: boolean;
  maxDepth?: number;
  localized?: boolean;
};

export type UploadField = RevealField & {
  type: 'upload';
  relationTo: string;
};

export type JoinField = RevealField & {
  type: 'join';
  collection: string | string[];
  on?: string;
};

export type TabAsField = RevealField & {
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

export const fieldHasMaxDepth = (field: Field): field is Field & { maxDepth: number } => {
  return 'maxDepth' in field && typeof field.maxDepth === 'number';
};

export const fieldShouldBeLocalized = ({ field, parentIsLocalized }: {
  field: Field;
  parentIsLocalized?: boolean;
}): boolean => {
  if (parentIsLocalized) return true;
  return field.localized === true;
};

export const fieldSupportsMany = (field: Field): field is Field & { hasMany: boolean } => {
  return 'hasMany' in field && field.hasMany === true;
};

export const fieldAffectsData = (field: Field): boolean => {
  return field.type !== 'ui' && (field.type as string) !== 'tab';
};

export const tabHasName = (tab: TabAsField): boolean => {
  return 'name' in tab && typeof tab.name === 'string';
};