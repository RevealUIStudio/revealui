/**
 * Prompts panel for `/mcp/inspect` (Stage 3.3).
 *
 * Lists prompts advertised by a connected remote MCP server. Each prompt
 * can be resolved by filling in its string-valued arguments and submitting;
 * inputs are completion-aware — as the user types we POST the partial
 * value to `/complete` with a `ref/prompt` reference to fetch server-side
 * suggestions.
 */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface PromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

interface Prompt {
  name: string;
  description?: string;
  arguments?: PromptArgument[];
}

interface PromptMessage {
  role: 'user' | 'assistant' | 'system';
  content: { type: string; text?: string; data?: string; mimeType?: string };
}

interface GetPromptResult {
  description?: string;
  messages: PromptMessage[];
}

interface PromptsPanelProps {
  tenant: string;
  server: string;
}

export function PromptsPanel({ tenant, server }: PromptsPanelProps) {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const loadPrompts = useCallback(async () => {
    setState('loading');
    setMessage(null);
    try {
      const res = await fetch(
        `/api/mcp/remote-servers/${encodeURIComponent(server)}/prompts?tenant=${encodeURIComponent(tenant)}`,
        { credentials: 'include' },
      );
      // empty-catch-ok: non-JSON error body — res.status surfaces below
      const body = (await res.json().catch(() => ({}))) as {
        prompts?: Prompt[];
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setPrompts(body.prompts ?? []);
      setState('ready');
    } catch (err) {
      setState('error');
      setMessage(`Failed to load prompts: ${(err as Error).message}`);
    }
  }, [tenant, server]);

  useEffect(() => {
    void loadPrompts();
  }, [loadPrompts]);

  return (
    <div className="space-y-4">
      {message && (
        <div
          role="alert"
          className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-xs text-red-300"
        >
          {message}
        </div>
      )}
      {state === 'loading' && (
        <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30 p-4 text-center text-xs text-zinc-500">
          Loading prompts…
        </div>
      )}
      {state === 'ready' && prompts.length === 0 && (
        <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30 p-4 text-center text-xs text-zinc-500">
          No prompts advertised.
        </div>
      )}
      {prompts.map((prompt) => (
        <PromptCard key={prompt.name} prompt={prompt} tenant={tenant} server={server} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Prompt card — form + resolver
// ---------------------------------------------------------------------------

interface PromptCardProps {
  prompt: Prompt;
  tenant: string;
  server: string;
}

function PromptCard({ prompt, tenant, server }: PromptCardProps) {
  const args = useMemo(() => prompt.arguments ?? [], [prompt.arguments]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<GetPromptResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    setError(null);
    try {
      const resolved: Record<string, string> = {};
      for (const a of args) {
        const v = values[a.name];
        if (v !== undefined && v !== '') resolved[a.name] = v;
      }
      const res = await fetch(`/api/mcp/remote-servers/${encodeURIComponent(server)}/get-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tenant, name: prompt.name, arguments: resolved }),
      });
      // empty-catch-ok: non-JSON error body — res.status surfaces below
      const body = (await res.json().catch(() => ({}))) as {
        result?: GetPromptResult;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setResult(body.result ?? null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <details className="group rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <summary className="flex cursor-pointer items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-sm font-semibold text-white">{prompt.name}</div>
          {prompt.description && (
            <div className="mt-0.5 line-clamp-1 text-xs text-zinc-400">{prompt.description}</div>
          )}
        </div>
        <span className="shrink-0 text-xs text-zinc-500 group-open:hidden">Expand</span>
      </summary>

      <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-3">
        {args.length === 0 && (
          <p className="text-xs text-zinc-500">
            This prompt takes no arguments. Click <span className="font-medium">Resolve</span> to
            fetch its messages.
          </p>
        )}
        {args.map((arg) => (
          <PromptArgumentField
            key={arg.name}
            arg={arg}
            prompt={prompt.name}
            tenant={tenant}
            server={server}
            value={values[arg.name] ?? ''}
            onChange={(value) => setValues((v) => ({ ...v, [arg.name]: value }))}
          />
        ))}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Resolving…' : 'Resolve'}
          </button>
          {error && <span className="text-xs text-red-400">{error}</span>}
        </div>
      </form>

      {result && <PromptResult result={result} />}
    </details>
  );
}

// ---------------------------------------------------------------------------
// Argument field — completion-aware (fetches server-side suggestions)
// ---------------------------------------------------------------------------

interface PromptArgumentFieldProps {
  arg: PromptArgument;
  prompt: string;
  tenant: string;
  server: string;
  value: string;
  onChange: (value: string) => void;
}

function PromptArgumentField({
  arg,
  prompt,
  tenant,
  server,
  value,
  onChange,
}: PromptArgumentFieldProps) {
  const inputId = `prompt-arg-${prompt}-${arg.name}`;
  const listId = `${inputId}-suggestions`;
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length === 0) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `/api/mcp/remote-servers/${encodeURIComponent(server)}/complete`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                tenant,
                ref: { type: 'ref/prompt', name: prompt },
                argument: { name: arg.name, value },
              }),
            },
          );
          if (!res.ok) return;
          // empty-catch-ok: non-JSON body means no suggestions — just leave the list empty
          const body = (await res.json().catch(() => ({}))) as {
            completion?: { values?: string[] };
          };
          setSuggestions(body.completion?.values ?? []);
        } catch {
          // empty-catch-ok: completions are a best-effort UX enhancement; a network blip shouldn't crash the form
          setSuggestions([]);
        }
      })();
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, prompt, arg.name, tenant, server]);

  return (
    <div>
      <label htmlFor={inputId} className="mb-1 block text-xs font-medium text-zinc-300">
        {arg.name}
        {arg.required && <span className="ml-1 text-red-400">*</span>}
      </label>
      <input
        id={inputId}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list={suggestions.length > 0 ? listId : undefined}
        required={arg.required}
        autoComplete="off"
        className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
      />
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
      {arg.description && <p className="mt-1 text-[11px] text-zinc-500">{arg.description}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Prompt result display
// ---------------------------------------------------------------------------

function PromptResult({ result }: { result: GetPromptResult }) {
  return (
    <div className="mt-4 space-y-3">
      {result.description && (
        <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3 text-xs text-zinc-400">
          {result.description}
        </div>
      )}
      {result.messages.map((msg, idx) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: messages have no id
        <div key={idx} className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3">
          <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-wide text-zinc-500">
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-zinc-300">{msg.role}</span>
            <span className="text-zinc-600">{msg.content.type}</span>
          </div>
          <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] text-zinc-200">
            {msg.content.type === 'text'
              ? (msg.content.text ?? '')
              : `[${msg.content.type}${msg.content.mimeType ? ` ${msg.content.mimeType}` : ''}]`}
          </pre>
        </div>
      ))}
    </div>
  );
}
