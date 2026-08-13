'use client';
import { Button, Checkbox, IconPlus } from '@revealui/presentation';
import type React from 'react';
import { useState } from 'react';
import type {
  RevealCollectionConfig,
  RevealDocument,
  RevealUIField,
} from '../../../types/index.js';

// Helper to resolve field label to a string
type LabelResolver = (args: { t: (key: string) => string }) => string;

function getFieldLabel(field: RevealUIField): string {
  const { label } = field;
  if (typeof label === 'function') {
    return (label as LabelResolver)({ t: (key) => key });
  }
  if (typeof label === 'string') {
    return label;
  }
  return typeof field.name === 'string' ? field.name : 'Field';
}

function formatTextValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (typeof value === 'symbol') return value.description ?? value.toString();
  if (typeof value === 'function') return value.name || 'function';
  return JSON.stringify(value);
}

function formatDateValue(value: unknown): string {
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString();
  }
  return '';
}

interface CollectionListProps {
  collection: RevealCollectionConfig;
  documents: RevealDocument[];
  totalDocs: number;
  page: number;
  totalPages: number;
  onCreate: () => void;
  onEdit: (doc: RevealDocument) => void;
  onDelete: (doc: RevealDocument) => void;
  onPageChange: (page: number) => void;
  deleting?: string | null;
  onBulkDelete?: (ids: string[]) => void;
  onBulkPublish?: (ids: string[]) => void;
}

export function CollectionList({
  collection,
  documents,
  totalDocs,
  page,
  totalPages,
  onCreate,
  onEdit,
  onDelete,
  onPageChange,
  deleting,
  onBulkDelete,
  onBulkPublish,
}: CollectionListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const hasBulk = Boolean(onBulkDelete || onBulkPublish);
  const allSelected = documents.length > 0 && selectedIds.size === documents.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(documents.map((d) => String(d.id))));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBulkAction = async (action: 'delete' | 'publish') => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkLoading(true);
    try {
      if (action === 'delete' && onBulkDelete) await onBulkDelete(ids);
      if (action === 'publish' && onBulkPublish) await onBulkPublish(ids);
      setSelectedIds(new Set());
    } finally {
      setBulkLoading(false);
    }
  };

  // Filter to only include fields with names (exclude layout fields) that are visible
  const displayFields = collection.fields
    .filter((field: RevealUIField) => {
      return field.name && field.admin?.position !== 'sidebar' && !field.admin?.hidden;
    })
    .slice(0, 5); // Show first 5 visible fields

  const colCount = displayFields.length + 1 + (hasBulk ? 1 : 0);

  return (
    <div className="bg-card shadow overflow-hidden sm:rounded-md">
      <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
        <div>
          <h3 className="text-lg leading-6 font-medium text-foreground capitalize">
            {collection.slug}
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {totalDocs} {totalDocs === 1 ? 'document' : 'documents'}
          </p>
        </div>
        <Button type="button" variant="brand" appearance="solid" onClick={onCreate}>
          <IconPlus size="sm" label="Create New" className="-ml-1 mr-2" />
          Create New
        </Button>
      </div>

      {/* Bulk action toolbar */}
      {hasBulk && selectedIds.size > 0 && (
        <div className="bg-primary/10 border-y border-primary/20 px-4 py-2 flex items-center gap-3">
          <span className="text-sm font-medium text-primary">{selectedIds.size} selected</span>
          {onBulkDelete && (
            <Button
              type="button"
              variant="danger"
              appearance="solid"
              size="sm"
              onClick={() => void handleBulkAction('delete')}
              disabled={bulkLoading}
            >
              Delete
            </Button>
          )}
          {onBulkPublish && (
            <Button
              type="button"
              variant="success"
              appearance="solid"
              size="sm"
              onClick={() => void handleBulkAction('publish')}
              disabled={bulkLoading}
            >
              Publish
            </Button>
          )}
          <Button
            type="button"
            variant="neutral"
            appearance="ghost"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto"
          >
            Clear selection
          </Button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              {hasBulk && (
                <th scope="col" className="w-10 px-3 py-3">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={() => toggleAll()}
                    aria-label="Select all"
                  />
                </th>
              )}
              {displayFields.map((field: RevealUIField) => (
                <th
                  key={field.name}
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                >
                  {getFieldLabel(field)}
                </th>
              ))}
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {documents.length === 0 ? (
              <tr>
                <td
                  colSpan={colCount}
                  className="px-6 py-4 text-center text-sm text-muted-foreground"
                >
                  No documents found.{' '}
                  <Button
                    type="button"
                    variant="brand"
                    appearance="link"
                    size="clear"
                    onClick={onCreate}
                    className="inline p-0 h-auto"
                  >
                    Create the first one
                  </Button>
                  .
                </td>
              </tr>
            ) : (
              documents.map((doc) => {
                const docId = String(doc.id);
                return (
                  <tr
                    key={docId}
                    className={`hover:bg-muted ${selectedIds.has(docId) ? 'bg-primary/10' : ''}`}
                  >
                    {hasBulk && (
                      <td className="w-10 px-3 py-4">
                        <Checkbox
                          checked={selectedIds.has(docId)}
                          onChange={() => toggleOne(docId)}
                          aria-label={`Select ${docId}`}
                        />
                      </td>
                    )}
                    {displayFields.map((field: RevealUIField) => (
                      <td
                        key={field.name}
                        className="px-6 py-4 whitespace-nowrap text-sm text-foreground"
                      >
                        {renderFieldValue(field.name ? doc[field.name] : undefined, field)}
                      </td>
                    ))}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <Button
                        type="button"
                        variant="brand"
                        appearance="link"
                        size="sm"
                        onClick={() => onEdit(doc)}
                        disabled={deleting !== null}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        appearance="link"
                        size="sm"
                        onClick={() => onDelete(doc)}
                        disabled={deleting !== null}
                      >
                        {deleting === docId ? 'Deleting...' : 'Delete'}
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-card px-4 py-3 flex items-center justify-between border-t border-border sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <Button
              type="button"
              variant="neutral"
              appearance="outline"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="neutral"
              appearance="outline"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="ml-3"
            >
              Next
            </Button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-foreground">
                Showing page <span className="font-medium">{page}</span> of{' '}
                <span className="font-medium">{totalPages}</span>
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <Button
                  type="button"
                  variant="neutral"
                  appearance="outline"
                  size="sm"
                  onClick={() => onPageChange(page - 1)}
                  disabled={page <= 1}
                  className="rounded-r-none"
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="neutral"
                  appearance="outline"
                  size="sm"
                  onClick={() => onPageChange(page + 1)}
                  disabled={page >= totalPages}
                  className="rounded-l-none"
                >
                  Next
                </Button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function renderFieldValue(value: unknown, field: RevealUIField): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">-</span>;
  }

  switch (field.type) {
    case 'text':
    case 'textarea':
      return formatTextValue(value);
    case 'number':
      return Number(value);
    case 'checkbox':
      return value ? '✓' : '✗';
    case 'date':
      return formatDateValue(value);
    case 'select':
      return formatTextValue(value);
    default:
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      return formatTextValue(value);
  }
}
