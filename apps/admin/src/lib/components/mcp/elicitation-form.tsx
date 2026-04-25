/**
 * Schema-driven elicitation form. Shared between Stage 3.4's
 * `StreamingToolCard` (where `elicitation/create` arrives during a tool
 * call to a single MCP server) and A.2b's
 * `/admin/agents/[agentId]/run` page (where it arrives mid-agent-run from
 * any of the connected servers).
 *
 * The form renders a JSON-Schema `requestedSchema` as a flat list of
 * inputs, with Accept / Decline / Cancel buttons. Submit returns an
 * `accept` action with the typed-coerced content; the parent decides
 * where to POST it (per-server admin route in the inspector flow,
 * `/api/agent-stream/elicit` in the agent-run flow).
 */

'use client';

import { useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JsonSchemaProperty {
  type?: string;
  description?: string;
  enum?: unknown[];
  default?: unknown;
}

export interface ElicitationSchema {
  type?: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

export type ElicitationAction = 'accept' | 'decline' | 'cancel';

// ---------------------------------------------------------------------------
// Argument field — single-input schema-driven control
// ---------------------------------------------------------------------------

interface ArgumentFieldProps {
  name: string;
  prop: JsonSchemaProperty;
  required: boolean;
  value: string;
  onChange: (value: string) => void;
}

export function ArgumentField({ name, prop, required, value, onChange }: ArgumentFieldProps) {
  const inputId = `arg-${name}`;
  const placeholder =
    prop.default !== undefined
      ? `default: ${JSON.stringify(prop.default)}`
      : prop.type === 'object' || prop.type === 'array'
        ? 'JSON value'
        : (prop.type ?? 'string');

  return (
    <div>
      <label htmlFor={inputId} className="mb-1 block text-xs font-medium text-zinc-300">
        {name}
        {required && <span className="ml-1 text-red-400">*</span>}
        <span className="ml-2 font-mono text-[10px] text-zinc-500">{prop.type ?? 'string'}</span>
      </label>
      {prop.enum && prop.enum.length > 0 ? (
        <select
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="">—</option>
          {prop.enum.map((opt) => (
            <option key={String(opt)} value={String(opt)}>
              {String(opt)}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={inputId}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      )}
      {prop.description && <p className="mt-1 text-[11px] text-zinc-500">{prop.description}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Elicitation form — renders the server's requestedSchema inline
// ---------------------------------------------------------------------------

export interface ElicitationFormProps {
  /**
   * Display message from the server. Optional — schema-only requests
   * (no prose) render the form without a header label.
   */
  message?: string;
  /**
   * JSON Schema describing the form fields. The form parses this once
   * and renders one `ArgumentField` per `properties` entry. Nested
   * objects/arrays are rendered as JSON-string text inputs (keeping the
   * surface flat); deep-nested schemas are out of scope today.
   */
  requestedSchema: ElicitationSchema;
  /**
   * Callback invoked when the user clicks Accept / Decline / Cancel.
   * Returns a promise so the parent can park the form during the round-trip
   * (e.g. show a spinner) without the form caring about the transport.
   */
  onSubmit: (action: ElicitationAction, content?: Record<string, unknown>) => Promise<void> | void;
}

export function ElicitationForm({ message, requestedSchema, onSubmit }: ElicitationFormProps) {
  const properties = requestedSchema.properties ?? {};
  const required = new Set(requestedSchema.required ?? []);
  const [values, setValues] = useState<Record<string, string>>({});

  const parseValue = (prop: JsonSchemaProperty, raw: string): unknown => {
    if (raw === '') return undefined;
    switch (prop.type) {
      case 'number':
      case 'integer': {
        const n = Number(raw);
        return Number.isFinite(n) ? n : raw;
      }
      case 'boolean':
        return raw === 'true';
      default:
        return raw;
    }
  };

  const handleAccept = (e: React.FormEvent) => {
    e.preventDefault();
    const content: Record<string, unknown> = {};
    for (const [key, prop] of Object.entries(properties)) {
      const raw = values[key] ?? '';
      const parsed = parseValue(prop, raw);
      if (parsed !== undefined) content[key] = parsed;
    }
    void onSubmit('accept', content);
  };

  return (
    <form
      onSubmit={handleAccept}
      className="mt-4 rounded-md border border-blue-800 bg-blue-900/10 p-3"
    >
      {message && (
        <div className="mb-3 flex items-center gap-2 text-xs">
          <span className="rounded-full bg-blue-500/20 px-2 py-0.5 font-medium text-blue-300">
            Server request
          </span>
          <span className="text-blue-200">{message}</span>
        </div>
      )}
      <div className="space-y-3">
        {Object.entries(properties).map(([key, prop]) => (
          <ArgumentField
            key={key}
            name={key}
            prop={prop}
            required={required.has(key)}
            value={values[key] ?? ''}
            onChange={(value) => setValues((v) => ({ ...v, [key]: value }))}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500"
        >
          Accept
        </button>
        <button
          type="button"
          onClick={() => void onSubmit('decline')}
          className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
        >
          Decline
        </button>
        <button
          type="button"
          onClick={() => void onSubmit('cancel')}
          className="rounded-md border border-red-800 bg-red-900/20 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-900/40"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
