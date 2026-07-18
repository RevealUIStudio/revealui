/**
 * Schema-driven elicitation form. Shared between Stage 3.4's
 * `StreamingToolCard` (where `elicitation/create` arrives during a tool
 * call to a single MCP server) and A.2b's
 * `/agents/[agentId]/run` page (where it arrives mid-agent-run from
 * any of the connected servers).
 *
 * The form renders a JSON-Schema `requestedSchema` as a flat list of
 * inputs, with Accept / Decline / Cancel buttons. Submit returns an
 * `accept` action with the typed-coerced content; the parent decides
 * where to POST it (per-server admin route in the inspector flow,
 * `/api/agent-stream/elicit` in the agent-run flow).
 */

'use client';

import { ButtonCVA, Input, Select } from '@revealui/presentation';
import { Description, Field, Label } from '@revealui/presentation/client';
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
  const placeholder =
    prop.default !== undefined
      ? `default: ${JSON.stringify(prop.default)}`
      : prop.type === 'object' || prop.type === 'array'
        ? 'JSON value'
        : (prop.type ?? 'string');

  return (
    <Field>
      <Label>
        {name}
        {required && <span className="ml-1 text-error">*</span>}
        <span className="ml-2 font-mono text-[10px] text-muted-foreground">
          {prop.type ?? 'string'}
        </span>
      </Label>
      {prop.enum && prop.enum.length > 0 ? (
        <Select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {prop.enum.map((opt) => (
            <option key={String(opt)} value={String(opt)}>
              {String(opt)}
            </option>
          ))}
        </Select>
      ) : (
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
        />
      )}
      {prop.description && <Description>{prop.description}</Description>}
    </Field>
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
      className="mt-4 rounded-md border border-primary/30 bg-primary/10 p-3"
    >
      {message && (
        <div className="mb-3 flex items-center gap-2 text-xs">
          <span className="rounded-full bg-primary/15 px-2 py-0.5 font-medium text-primary">
            Server request
          </span>
          <span className="text-primary">{message}</span>
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
        <ButtonCVA type="submit" variant="brand" size="sm">
          Accept
        </ButtonCVA>
        <ButtonCVA
          type="button"
          appearance="outline"
          variant="neutral"
          size="sm"
          onClick={() => void onSubmit('decline')}
        >
          Decline
        </ButtonCVA>
        <ButtonCVA type="button" variant="danger" size="sm" onClick={() => void onSubmit('cancel')}>
          Cancel
        </ButtonCVA>
      </div>
    </form>
  );
}
