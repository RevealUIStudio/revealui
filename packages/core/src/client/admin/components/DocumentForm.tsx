'use client';
import type React from 'react';
import { lazy, Suspense, useCallback, useState } from 'react';
import type { RichTextEditor as RichTextEditorConfig } from '../../../richtext/index.js';
import type {
  RevealCollectionConfig,
  RevealDocument,
  RevealUIField,
} from '../../../types/index.js';

// Lazy-loaded so Lexical (~1.2MB) is only bundled for edit pages with richText
// fields  -  list/dashboard pages skip the entire Lexical chunk.
const RichTextEditor = lazy(() =>
  import('../../richtext/RichTextEditor.js').then((m) => ({ default: m.RichTextEditor })),
);

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

function formatDateInputValue(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 16);
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 16);
  }
  return '';
}

// Flatten tabs/rows and skip sidebar/hidden/disabled fields
function getVisibleFields(fields: RevealUIField[]): RevealUIField[] {
  const result: RevealUIField[] = [];
  for (const field of fields) {
    if (field.admin?.position === 'sidebar' || field.admin?.hidden || field.admin?.disabled) {
      continue;
    }
    const anyField = field as unknown as Record<string, unknown>;
    if (field.type === 'tabs' && Array.isArray(anyField.tabs)) {
      for (const tab of anyField.tabs as Array<{ fields?: RevealUIField[] }>) {
        result.push(...getVisibleFields(tab.fields ?? []));
      }
    } else if (field.type === 'row' && Array.isArray(anyField.fields)) {
      result.push(...getVisibleFields(anyField.fields as RevealUIField[]));
    } else {
      result.push(field);
    }
  }
  return result;
}

interface DocumentFormProps {
  collection: RevealCollectionConfig;
  document?: RevealDocument;
  onSave: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function DocumentForm({
  collection,
  document,
  onSave,
  onCancel,
  isLoading = false,
}: DocumentFormProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>(document || {});

  const visibleFields = getVisibleFields(collection.fields);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleFieldChange = (fieldName: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
  };

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
          {document ? 'Edit' : 'Create'} {collection.slug.slice(0, -1)}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-6">
          {visibleFields.map((field: RevealUIField) => (
            <div key={field.name || 'layout'}>
              <label htmlFor={field.name} className="block text-sm font-medium text-gray-700">
                {getFieldLabel(field)}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              <div className="mt-1">
                <FieldInput
                  field={field}
                  value={field.name ? formData[field.name] : undefined}
                  onChange={(value) => field.name && handleFieldChange(field.name, value)}
                />
              </div>
            </div>
          ))}

          <div className="flex justify-end space-x-3 pt-6">
            <button
              type="button"
              onClick={onCancel}
              className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface FieldInputProps {
  field: RevealUIField;
  value: unknown;
  onChange: (value: unknown) => void;
}

// ---------------------------------------------------------------------------
// Array field: repeatable list of sub-fields
// ---------------------------------------------------------------------------
function ArrayFieldRenderer({
  field,
  value,
  onChange,
}: {
  field: RevealUIField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const rows = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
  const subFields = (field as unknown as { fields?: RevealUIField[] }).fields ?? [];

  const addRow = () => onChange([...rows, {}]);
  const removeRow = (idx: number) => onChange(rows.filter((_, i) => i !== idx));
  const updateRow = (idx: number, key: string, val: unknown) => {
    const updated = rows.map((row, i) => (i === idx ? { ...row, [key]: val } : row));
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {rows.map((row, idx) => (
        <div
          key={`${field.name}-row-${idx.toString()}`}
          className="border border-gray-200 rounded-md p-3 space-y-2 relative"
        >
          <button
            type="button"
            onClick={() => removeRow(idx)}
            className="absolute top-2 right-2 text-red-400 hover:text-red-600 text-sm"
          >
            Remove
          </button>
          {subFields.map((sf) => (
            <div key={sf.name}>
              <label
                htmlFor={`${field.name}-${idx}-${sf.name}`}
                className="block text-xs font-medium text-gray-600"
              >
                {getFieldLabel(sf)}
              </label>
              <FieldInput
                field={sf}
                value={row[sf.name ?? '']}
                onChange={(v) => updateRow(idx, sf.name ?? '', v)}
              />
            </div>
          ))}
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
      >
        + Add item
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Group field: named group of sub-fields (single object, not repeatable)
// ---------------------------------------------------------------------------
function GroupFieldRenderer({
  field,
  value,
  onChange,
}: {
  field: RevealUIField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const data = (typeof value === 'object' && value !== null ? value : {}) as Record<
    string,
    unknown
  >;
  const subFields = (field as unknown as { fields?: RevealUIField[] }).fields ?? [];

  const handleChange = (key: string, val: unknown) => {
    onChange({ ...data, [key]: val });
  };

  return (
    <div className="border border-gray-200 rounded-md p-3 space-y-3">
      {subFields.map((sf) => (
        <div key={sf.name}>
          <label
            htmlFor={`${field.name}-${sf.name}`}
            className="block text-xs font-medium text-gray-600"
          >
            {getFieldLabel(sf)}
            {sf.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <FieldInput
            field={sf}
            value={data[sf.name ?? '']}
            onChange={(v) => handleChange(sf.name ?? '', v)}
          />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Blocks field: polymorphic list of typed blocks
// ---------------------------------------------------------------------------
function BlocksFieldRenderer({
  field,
  value,
  onChange,
}: {
  field: RevealUIField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const blocks = Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
  const blockTypes =
    (field as unknown as { blocks?: Array<{ slug: string; fields?: RevealUIField[] }> }).blocks ??
    [];

  const addBlock = (slug: string) => {
    onChange([...blocks, { blockType: slug }]);
  };
  const removeBlock = (idx: number) => onChange(blocks.filter((_, i) => i !== idx));
  const updateBlock = (idx: number, key: string, val: unknown) => {
    const updated = blocks.map((b, i) => (i === idx ? { ...b, [key]: val } : b));
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {blocks.map((block, idx) => {
        const blockDef = blockTypes.find((bt) => bt.slug === block.blockType);
        return (
          <div
            key={`${field.name}-block-${idx.toString()}`}
            className="border border-gray-200 rounded-md p-3 space-y-2 relative"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-gray-500 uppercase">
                {String(block.blockType)}
              </span>
              <button
                type="button"
                onClick={() => removeBlock(idx)}
                className="text-red-400 hover:text-red-600 text-sm"
              >
                Remove
              </button>
            </div>
            {(blockDef?.fields ?? []).map((sf) => (
              <div key={sf.name}>
                <label
                  htmlFor={`${field.name}-${idx}-${sf.name}`}
                  className="block text-xs font-medium text-gray-600"
                >
                  {getFieldLabel(sf)}
                </label>
                <FieldInput
                  field={sf}
                  value={block[sf.name ?? '']}
                  onChange={(v) => updateBlock(idx, sf.name ?? '', v)}
                />
              </div>
            ))}
          </div>
        );
      })}
      {blockTypes.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {blockTypes.map((bt) => (
            <button
              key={bt.slug}
              type="button"
              onClick={() => addBlock(bt.slug)}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              + {bt.slug}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible field: expandable section of sub-fields
// ---------------------------------------------------------------------------
function CollapsibleFieldRenderer({
  field,
  value,
  onChange,
}: {
  field: RevealUIField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const [open, setOpen] = useState(true);
  const data = (typeof value === 'object' && value !== null ? value : {}) as Record<
    string,
    unknown
  >;
  const subFields = (field as unknown as { fields?: RevealUIField[] }).fields ?? [];

  const handleChange = (key: string, val: unknown) => {
    onChange({ ...data, [key]: val });
  };

  return (
    <div className="border border-gray-200 rounded-md">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full text-left px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-between"
      >
        {getFieldLabel(field)}
        <span className="text-gray-400">{open ? '\u25B2' : '\u25BC'}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3">
          {subFields.map((sf) => (
            <div key={sf.name}>
              <label
                htmlFor={`${field.name}-${sf.name}`}
                className="block text-xs font-medium text-gray-600"
              >
                {getFieldLabel(sf)}
              </label>
              <FieldInput
                field={sf}
                value={data[sf.name ?? '']}
                onChange={(v) => handleChange(sf.name ?? '', v)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// JSON field: raw JSON editor with syntax-highlighted textarea
// ---------------------------------------------------------------------------
function JsonFieldRenderer({
  field,
  value,
  onChange,
}: {
  field: RevealUIField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const formatted =
    typeof value === 'string' ? value : value != null ? JSON.stringify(value, null, 2) : '';

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const raw = e.target.value;
      try {
        const parsed = JSON.parse(raw) as unknown;
        setError(null);
        onChange(parsed);
      } catch {
        setError('Invalid JSON');
        onChange(raw);
      }
    },
    [onChange],
  );

  return (
    <div>
      <textarea
        id={field.name}
        value={formatted}
        onChange={handleChange}
        rows={8}
        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-mono text-xs"
        spellCheck={false}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Point field: latitude/longitude pair
// ---------------------------------------------------------------------------
function PointFieldRenderer({
  field,
  value,
  onChange,
}: {
  field: RevealUIField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const point = (typeof value === 'object' && value !== null ? value : { lat: 0, lng: 0 }) as {
    lat: number;
    lng: number;
  };
  const baseClasses =
    'mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm';

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label htmlFor={`${field.name}-lat`} className="block text-xs font-medium text-gray-600">
          Latitude
        </label>
        <input
          type="number"
          id={`${field.name}-lat`}
          value={point.lat}
          onChange={(e) => onChange({ ...point, lat: Number(e.target.value) })}
          className={baseClasses}
          step="any"
          min={-90}
          max={90}
        />
      </div>
      <div>
        <label htmlFor={`${field.name}-lng`} className="block text-xs font-medium text-gray-600">
          Longitude
        </label>
        <input
          type="number"
          id={`${field.name}-lng`}
          value={point.lng}
          onChange={(e) => onChange({ ...point, lng: Number(e.target.value) })}
          className={baseClasses}
          step="any"
          min={-180}
          max={180}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main FieldInput  -  renders the appropriate control for each field type
// ---------------------------------------------------------------------------
function FieldInput({ field, value, onChange }: FieldInputProps) {
  const baseClasses =
    'mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm';

  switch (field.type) {
    case 'text':
      return (
        <input
          type="text"
          id={field.name}
          value={formatTextValue(value)}
          onChange={(e) => onChange(e.target.value)}
          className={baseClasses}
          required={field.required}
        />
      );

    case 'email':
      return (
        <input
          type="email"
          id={field.name}
          value={formatTextValue(value)}
          onChange={(e) => onChange(e.target.value)}
          className={baseClasses}
          required={field.required}
          placeholder={field.admin?.placeholder as string | undefined}
        />
      );

    case 'password':
      return (
        <input
          type="password"
          id={field.name}
          value={formatTextValue(value)}
          onChange={(e) => onChange(e.target.value)}
          className={baseClasses}
          required={field.required}
          autoComplete="new-password"
        />
      );

    case 'code':
      return (
        <textarea
          id={field.name}
          value={formatTextValue(value)}
          onChange={(e) => onChange(e.target.value)}
          rows={8}
          className={`${baseClasses} font-mono text-xs`}
          required={field.required}
          spellCheck={false}
        />
      );

    case 'textarea':
      return (
        <textarea
          id={field.name}
          value={formatTextValue(value)}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className={baseClasses}
          required={field.required}
        />
      );

    case 'number':
      return (
        <input
          type="number"
          id={field.name}
          value={typeof value === 'number' ? value : value ? Number(value) : ''}
          onChange={(e) => onChange(Number(e.target.value) || undefined)}
          className={baseClasses}
          required={field.required}
          min={field.min}
          max={field.max}
        />
      );

    case 'checkbox':
      return (
        <input
          type="checkbox"
          id={field.name}
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
        />
      );

    case 'select':
      return (
        <select
          id={field.name}
          value={formatTextValue(value)}
          onChange={(e) => onChange(e.target.value)}
          className={baseClasses}
          required={field.required}
        >
          <option value="">Select an option</option>
          {field.options?.map((option) => {
            const optValue = typeof option === 'string' ? option : option.value;
            const optLabel = typeof option === 'string' ? option : option.label;
            return (
              <option key={optValue} value={optValue}>
                {optLabel}
              </option>
            );
          })}
        </select>
      );

    case 'radio':
      return (
        <div className="space-y-2 mt-1">
          {field.options?.map((option) => {
            const optValue = typeof option === 'string' ? option : option.value;
            const optLabel = typeof option === 'string' ? option : option.label;
            return (
              <label
                key={optValue}
                className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
              >
                <input
                  type="radio"
                  name={field.name}
                  value={optValue}
                  checked={formatTextValue(value) === optValue}
                  onChange={() => onChange(optValue)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                />
                {optLabel}
              </label>
            );
          })}
        </div>
      );

    case 'relationship':
      return (
        <div>
          <input
            type="text"
            id={field.name}
            value={formatTextValue(value)}
            onChange={(e) => onChange(e.target.value)}
            className={baseClasses}
            required={field.required}
            placeholder={`Enter ${(field as unknown as { relationTo?: string }).relationTo ?? 'related'} ID`}
          />
          <p className="mt-1 text-xs text-gray-400">
            Related to: {(field as unknown as { relationTo?: string }).relationTo ?? 'unknown'}
          </p>
        </div>
      );

    case 'upload':
      return (
        <div>
          <input
            type="file"
            id={field.name}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onChange(file);
            }}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          />
          {typeof value === 'string' && value !== '' && (
            <p className="mt-1 text-xs text-gray-500">Current: {value}</p>
          )}
        </div>
      );

    case 'date':
      return (
        <input
          type="datetime-local"
          id={field.name}
          value={formatDateInputValue(value)}
          onChange={(e) => onChange(e.target.value ? new Date(e.target.value) : null)}
          className={baseClasses}
          required={field.required}
        />
      );

    case 'richText': {
      const editorConfig = (field as { editor?: RichTextEditorConfig }).editor;
      return (
        <Suspense
          fallback={
            <div className="border border-gray-300 rounded-md h-40 flex items-center justify-center text-sm text-gray-400">
              Loading editor…
            </div>
          }
        >
          <RichTextEditor
            namespace={String(field.name)}
            editorConfig={editorConfig}
            initialValue={value as string | null | undefined}
            onSerializedChange={(json) => onChange(json)}
            className="border border-gray-300 rounded-md"
          />
        </Suspense>
      );
    }

    case 'array':
      return <ArrayFieldRenderer field={field} value={value} onChange={onChange} />;

    case 'group':
      return <GroupFieldRenderer field={field} value={value} onChange={onChange} />;

    case 'blocks':
      return <BlocksFieldRenderer field={field} value={value} onChange={onChange} />;

    case 'collapsible':
      return <CollapsibleFieldRenderer field={field} value={value} onChange={onChange} />;

    case 'json':
      return <JsonFieldRenderer field={field} value={value} onChange={onChange} />;

    case 'point':
      return <PointFieldRenderer field={field} value={value} onChange={onChange} />;

    case 'ui':
      return (
        <div className="border border-dashed border-gray-300 rounded-md p-3 text-sm text-gray-400 text-center">
          Custom UI field: {field.name}
        </div>
      );

    default:
      return (
        <input
          type="text"
          id={field.name}
          value={formatTextValue(value)}
          onChange={(e) => onChange(e.target.value)}
          className={baseClasses}
          required={field.required}
        />
      );
  }
}
