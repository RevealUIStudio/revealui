/**
 * Streaming agent execution page.
 *
 * `GET /admin/agents/[agentId]/run` — first user-visible Stage 5 surface
 * (A.2b-frontend of the post-v1 MCP arc). Submits an instruction to
 * `/api/agent-stream`, consumes the SSE response via `useAgentStream`,
 * and renders the chunk stream live: tool calls, sampling requests, and
 * inline elicitation forms.
 *
 * The polling `TaskTester` on the agent detail page stays as a fallback
 * — A.2b-frontend adds a "Watch live" link there that routes here. A.4+
 * may deprecate `TaskTester` once this page is proven.
 */

'use client';

import { Breadcrumb } from '@revealui/presentation/client';
import Link from 'next/link';
import { use, useState } from 'react';
import { LicenseGate } from '@/lib/components/LicenseGate';
import { ElicitationForm, type ElicitationSchema } from '@/lib/components/mcp/elicitation-form';
import { type AgentStreamChunk, useAgentStream } from '@/lib/hooks/useAgentStream';

interface PageProps {
  params: Promise<{ agentId: string }>;
}

export default function AgentRunPage({ params }: PageProps) {
  const { agentId } = use(params);
  const [instruction, setInstruction] = useState('');
  const [mode, setMode] = useState<'admin' | 'coding'>('admin');
  const stream = useAgentStream();

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = instruction.trim();
    if (!trimmed) return;
    void stream.start({ instruction: trimmed, mode });
  };

  return (
    <LicenseGate feature="ai">
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <Breadcrumb
          items={[
            { label: 'Admin', href: '/' },
            { label: 'Agents', href: '/agents' },
            { label: agentId, href: `/agents/${agentId}` },
            { label: 'Run' },
          ]}
        />

        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-zinc-100">Run agent — live stream</h1>
          <p className="text-sm text-zinc-400">
            Submits an instruction to{' '}
            <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs">/api/agent-stream</code> and
            renders chunks in real time. Connected MCP servers can call{' '}
            <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs">sampling/create</code> and{' '}
            <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs">elicitation/create</code>{' '}
            mid-run; both surface here.{' '}
            <Link href={`/agents/${agentId}`} className="text-emerald-400 hover:text-emerald-300">
              ← Back to agent detail
            </Link>
          </p>
        </header>

        <form
          onSubmit={handleStart}
          className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4"
        >
          <label htmlFor="instruction" className="block text-sm font-medium text-zinc-200">
            Instruction
          </label>
          <textarea
            id="instruction"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            disabled={stream.isStreaming}
            rows={4}
            placeholder="What would you like the agent to do?"
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
          />
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-zinc-300">
              <span>Mode</span>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as 'admin' | 'coding')}
                disabled={stream.isStreaming}
                className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
              >
                <option value="admin">admin</option>
                <option value="coding">coding</option>
              </select>
            </label>
            <div className="flex-1" />
            {!stream.isStreaming && (
              <button
                type="submit"
                disabled={!instruction.trim()}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Start agent
              </button>
            )}
            {stream.isStreaming && (
              <button
                type="button"
                onClick={stream.abort}
                className="rounded-md border border-red-800 bg-red-900/30 px-4 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-900/50"
              >
                Cancel
              </button>
            )}
            {!stream.isStreaming && stream.chunks.length > 0 && (
              <button
                type="button"
                onClick={stream.reset}
                className="rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-700"
              >
                Clear
              </button>
            )}
          </div>
        </form>

        <StatusBar
          isStreaming={stream.isStreaming}
          sessionId={stream.sessionId}
          chunkCount={stream.chunks.length}
          error={stream.error}
        />

        {stream.pendingElicitations.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-blue-300">
              Pending input ({stream.pendingElicitations.length})
            </h2>
            {stream.pendingElicitations.map((pending) => (
              <ElicitationCard
                key={pending.elicitationId}
                namespace={pending.namespace}
                requestedSchema={pending.requestedSchema}
                message={pending.message}
                onSubmit={(action, content) =>
                  stream.submitElicitation(pending.elicitationId, action, content)
                }
              />
            ))}
          </section>
        )}

        {stream.text && (
          <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
            <h2 className="mb-2 text-sm font-medium text-zinc-300">Agent output</h2>
            <pre className="whitespace-pre-wrap text-sm text-zinc-100">{stream.text}</pre>
          </section>
        )}

        {stream.chunks.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-medium text-zinc-300">Event log</h2>
            <ol className="space-y-2">
              {stream.chunks.map((chunk, idx) => (
                <ChunkRow key={idx} chunk={chunk} index={idx} />
              ))}
            </ol>
          </section>
        )}
      </div>
    </LicenseGate>
  );
}

// ---------------------------------------------------------------------------
// Status bar — running / idle indicator + sessionId + chunk count
// ---------------------------------------------------------------------------

interface StatusBarProps {
  isStreaming: boolean;
  sessionId: string | null;
  chunkCount: number;
  error: string | null;
}

function StatusBar({ isStreaming, sessionId, chunkCount, error }: StatusBarProps) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-400">
      <span
        className={`inline-flex h-2 w-2 rounded-full ${
          error ? 'bg-red-500' : isStreaming ? 'animate-pulse bg-emerald-500' : 'bg-zinc-600'
        }`}
        aria-hidden="true"
      />
      <span>{error ? 'Error' : isStreaming ? 'Streaming' : 'Idle'}</span>
      <span className="text-zinc-600">·</span>
      <span>chunks: {chunkCount}</span>
      {sessionId && (
        <>
          <span className="text-zinc-600">·</span>
          <span className="font-mono text-zinc-500">session {sessionId.slice(0, 8)}</span>
        </>
      )}
      {error && (
        <>
          <span className="text-zinc-600">·</span>
          <span className="text-red-400">{error}</span>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Elicitation card — wraps the shared ElicitationForm with namespace label
// ---------------------------------------------------------------------------

interface ElicitationCardProps {
  namespace: string;
  requestedSchema: unknown;
  message?: string;
  onSubmit: Parameters<typeof ElicitationForm>[0]['onSubmit'];
}

function ElicitationCard({ namespace, requestedSchema, message, onSubmit }: ElicitationCardProps) {
  // Narrow the unknown schema to the form's expected shape. Malformed
  // schemas degrade to "no fields" — the form still renders the
  // accept/decline/cancel buttons so the user is never trapped.
  const schema = (
    typeof requestedSchema === 'object' && requestedSchema !== null
      ? (requestedSchema as ElicitationSchema)
      : { type: 'object', properties: {} }
  ) satisfies ElicitationSchema;

  return (
    <div className="rounded-lg border border-blue-800 bg-blue-900/10 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs text-blue-300">
        <span className="font-mono">{namespace}</span>
        <span className="text-blue-700">·</span>
        <span>requesting input</span>
      </div>
      <ElicitationForm message={message} requestedSchema={schema} onSubmit={onSubmit} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chunk row — per-event rendering for the event log
// ---------------------------------------------------------------------------

function ChunkRow({ chunk, index }: { chunk: AgentStreamChunk; index: number }) {
  switch (chunk.type) {
    case 'session_info':
      return (
        <li className="rounded-md border border-zinc-800 bg-zinc-900/30 px-3 py-2 text-xs text-zinc-500">
          <span className="font-mono text-zinc-600">[{index}]</span> session_info{' '}
          <span className="font-mono">{chunk.sessionId?.slice(0, 8)}…</span>
        </li>
      );
    case 'text':
      return (
        <li className="rounded-md border border-zinc-800 bg-zinc-900/30 px-3 py-2 text-xs">
          <span className="font-mono text-zinc-600">[{index}]</span>{' '}
          <span className="text-zinc-400">text</span>{' '}
          <span className="text-zinc-200">{chunk.content?.slice(0, 80)}</span>
          {chunk.content && chunk.content.length > 80 && <span className="text-zinc-500">…</span>}
        </li>
      );
    case 'tool_call_start':
      return (
        <li className="rounded-md border border-emerald-900 bg-emerald-900/10 px-3 py-2 text-xs">
          <span className="font-mono text-zinc-600">[{index}]</span>{' '}
          <span className="font-medium text-emerald-300">tool call</span>{' '}
          <span className="font-mono text-emerald-200">{chunk.toolCall?.name}</span>
        </li>
      );
    case 'tool_call_result':
      return (
        <li className="rounded-md border border-emerald-900 bg-emerald-900/10 px-3 py-2 text-xs">
          <span className="font-mono text-zinc-600">[{index}]</span>{' '}
          <span className="text-emerald-300">tool result</span>
        </li>
      );
    case 'sampling_request':
      return (
        <li className="rounded-md border border-purple-900 bg-purple-900/10 px-3 py-2 text-xs">
          <span className="font-mono text-zinc-600">[{index}]</span>{' '}
          <span className="font-medium text-purple-300">sampling</span>{' '}
          {chunk.namespace && <span className="font-mono text-purple-200">{chunk.namespace}</span>}{' '}
          <span className="text-zinc-500">
            model={chunk.sampling?.model}, messages={chunk.sampling?.messageCount}, maxTokens=
            {chunk.sampling?.maxTokens}
          </span>
        </li>
      );
    case 'elicitation_request':
      return (
        <li className="rounded-md border border-blue-900 bg-blue-900/10 px-3 py-2 text-xs">
          <span className="font-mono text-zinc-600">[{index}]</span>{' '}
          <span className="font-medium text-blue-300">elicitation</span>{' '}
          {chunk.namespace && <span className="font-mono text-blue-200">{chunk.namespace}</span>}{' '}
          <span className="text-zinc-500">id={chunk.elicitation?.elicitationId.slice(0, 8)}…</span>
        </li>
      );
    case 'error':
      return (
        <li className="rounded-md border border-red-800 bg-red-900/20 px-3 py-2 text-xs text-red-300">
          <span className="font-mono text-zinc-600">[{index}]</span> error{' '}
          <span className="text-red-200">{chunk.error}</span>
        </li>
      );
    case 'done':
      return (
        <li className="rounded-md border border-zinc-700 bg-zinc-800/30 px-3 py-2 text-xs text-zinc-300">
          <span className="font-mono text-zinc-600">[{index}]</span> done
        </li>
      );
    default:
      return (
        <li className="rounded-md border border-zinc-800 bg-zinc-900/30 px-3 py-2 text-xs text-zinc-500">
          <span className="font-mono text-zinc-600">[{index}]</span> {String(chunk.type)}
        </li>
      );
  }
}
