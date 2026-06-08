'use client';
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
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-ring"
        >
          <svg
            className="-ml-1 mr-2 h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
            role="img"
            focusable="false"
          >
            <title>Create New</title>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create New
        </button>
      </div>

      {/* Bulk action toolbar */}
      {hasBulk && selectedIds.size > 0 && (
        <div className="bg-primary/10 border-y border-primary/20 px-4 py-2 flex items-center gap-3">
          <span className="text-sm font-medium text-primary">{selectedIds.size} selected</span>
          {onBulkDelete && (
            <button
              type="button"
              onClick={() => void handleBulkAction('delete')}
              disabled={bulkLoading}
              className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 disabled:opacity-50"
            >
              Delete
            </button>
          )}
          {onBulkPublish && (
            <button
              type="button"
              onClick={() => void handleBulkAction('publish')}
              disabled={bulkLoading}
              className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-md text-success bg-success/15 hover:bg-success/25 disabled:opacity-50"
            >
              Publish
            </button>
          )}
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
          >
            Clear selection
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              {hasBulk && (
                <th scope="col" className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
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
                  <button
                    type="button"
                    onClick={onCreate}
                    className="text-primary hover:text-primary/80"
                  >
                    Create the first one
                  </button>
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
                        <input
                          type="checkbox"
                          checked={selectedIds.has(docId)}
                          onChange={() => toggleOne(docId)}
                          className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
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
                      <button
                        type="button"
                        onClick={() => onEdit(doc)}
                        className="text-primary hover:text-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={deleting !== null}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(doc)}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={deleting !== null}
                      >
                        {deleting === docId ? 'Deleting...' : 'Delete'}
                      </button>
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
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="relative inline-flex items-center px-4 py-2 border border-input text-sm font-medium rounded-md text-foreground bg-card hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-input text-sm font-medium rounded-md text-foreground bg-card hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
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
                <button
                  type="button"
                  onClick={() => onPageChange(page - 1)}
                  disabled={page <= 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-input bg-card text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => onPageChange(page + 1)}
                  disabled={page >= totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-input bg-card text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
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
