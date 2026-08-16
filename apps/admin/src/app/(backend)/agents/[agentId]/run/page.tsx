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

import { Breadcrumb, Button, Card, Select, Textarea } from '@revealui/presentation';
import { Field, Label } from '@revealui/presentation/client';
import Link from 'next/link';
import { type ChangeEvent, use, useState } from 'react';
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
    void stream.start({ instruction: trimmed, mode, agentId });
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
          <h1 className="text-2xl font-semibold text-foreground">Run agent — live stream</h1>
          <p className="text-sm text-muted-foreground">
            Submits an instruction to{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">/api/agent-stream</code> and
            renders chunks in real time. Connected MCP servers can call{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">sampling/create</code> and{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">elicitation/create</code>{' '}
            mid-run; both surface here.{' '}
            <Link href={`/agents/${agentId}`} className="text-success hover:text-success">
              ← Back to agent detail
            </Link>
          </p>
        </header>

        <Card className="p-4">
          <form onSubmit={handleStart} className="space-y-3">
            <Field>
              <Label>Instruction</Label>
              <Textarea
                name="instruction"
                value={instruction}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setInstruction(e.target.value)}
                disabled={stream.isStreaming}
                rows={4}
                placeholder="What would you like the agent to do?"
              />
            </Field>
            <div className="flex items-center gap-3">
              <Field>
                <Label>Mode</Label>
                <Select
                  name="mode"
                  value={mode}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                    setMode(e.target.value as 'admin' | 'coding')
                  }
                  disabled={stream.isStreaming}
                >
                  <option value="admin">admin</option>
                  <option value="coding">coding</option>
                </Select>
              </Field>
              <div className="flex-1" />
              {!stream.isStreaming && (
                <Button type="submit" disabled={!instruction.trim()} variant="brand" size="sm">
                  Start agent
                </Button>
              )}
              {stream.isStreaming && (
                <Button
                  type="button"
                  onClick={stream.abort}
                  appearance="outline"
                  variant="neutral"
                  size="sm"
                  className="border-error/30 bg-error/10 text-error hover:bg-error/15"
                >
                  Cancel
                </Button>
              )}
              {!stream.isStreaming && stream.chunks.length > 0 && (
                <Button type="button" onClick={stream.reset} appearance="ghost" size="sm">
                  Clear
                </Button>
              )}
            </div>
          </form>
        </Card>

        <StatusBar
          isStreaming={stream.isStreaming}
          sessionId={stream.sessionId}
          chunkCount={stream.chunks.length}
          error={stream.error}
        />

        {stream.pendingElicitations.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-primary">
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
          <Card className="p-4">
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">Agent output</h2>
            <pre className="whitespace-pre-wrap text-sm text-foreground">{stream.text}</pre>
          </Card>
        )}

        {stream.chunks.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">Event log</h2>
            <ol className="space-y-2">
              {stream.chunks.map((chunk, idx) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: streaming chunks are append-only, never reordered
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
    <div className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
      <span
        className={`inline-flex h-2 w-2 rounded-full ${
          error ? 'bg-error' : isStreaming ? 'animate-pulse bg-success' : 'bg-foreground/10'
        }`}
        aria-hidden="true"
      />
      <span>{error ? 'Error' : isStreaming ? 'Streaming' : 'Idle'}</span>
      <span className="text-muted-foreground">·</span>
      <span>chunks: {chunkCount}</span>
      {sessionId && (
        <>
          <span className="text-muted-foreground">·</span>
          <span className="font-mono text-muted-foreground">session {sessionId.slice(0, 8)}</span>
        </>
      )}
      {error && (
        <>
          <span className="text-muted-foreground">·</span>
          <span className="text-error">{error}</span>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Elicitation card — wraps the shared ElicitationForm with namespace label
// Border uses primary/30 tint (not Card's border-border) — left as handroll
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
    <div className="rounded-lg border border-primary/30 bg-primary/10 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs text-primary">
        <span className="font-mono">{namespace}</span>
        <span className="text-primary">·</span>
        <span>requesting input</span>
      </div>
      <ElicitationForm message={message} requestedSchema={schema} onSubmit={onSubmit} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chunk row — per-event rendering for the event log
// Log rows use tinted borders per event type — not generic Card
// ---------------------------------------------------------------------------

function ChunkRow({ chunk, index }: { chunk: AgentStreamChunk; index: number }) {
  switch (chunk.type) {
    case 'session_info':
      return (
        <li className="rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          <span className="font-mono text-muted-foreground">[{index}]</span> session_info{' '}
          <span className="font-mono">{chunk.sessionId?.slice(0, 8)}…</span>
        </li>
      );
    case 'text':
      return (
        <li className="rounded-md border border-border bg-card px-3 py-2 text-xs">
          <span className="font-mono text-muted-foreground">[{index}]</span>{' '}
          <span className="text-muted-foreground">text</span>{' '}
          <span className="text-muted-foreground">{chunk.content?.slice(0, 80)}</span>
          {chunk.content && chunk.content.length > 80 && (
            <span className="text-muted-foreground">…</span>
          )}
        </li>
      );
    case 'tool_call_start':
      return (
        <li className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-xs">
          <span className="font-mono text-muted-foreground">[{index}]</span>{' '}
          <span className="font-medium text-success">tool call</span>{' '}
          <span className="font-mono text-success">{chunk.toolCall?.name}</span>
        </li>
      );
    case 'tool_call_result':
      return (
        <li className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-xs">
          <span className="font-mono text-muted-foreground">[{index}]</span>{' '}
          <span className="text-success">tool result</span>
        </li>
      );
    case 'sampling_request':
      return (
        <li className="rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-xs">
          <span className="font-mono text-muted-foreground">[{index}]</span>{' '}
          <span className="font-medium text-accent-foreground">sampling</span>{' '}
          {chunk.namespace && (
            <span className="font-mono text-accent-foreground">{chunk.namespace}</span>
          )}{' '}
          <span className="text-muted-foreground">
            model={chunk.sampling?.model}, messages={chunk.sampling?.messageCount}, maxTokens=
            {chunk.sampling?.maxTokens}
          </span>
        </li>
      );
    case 'elicitation_request':
      return (
        <li className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs">
          <span className="font-mono text-muted-foreground">[{index}]</span>{' '}
          <span className="font-medium text-primary">elicitation</span>{' '}
          {chunk.namespace && <span className="font-mono text-primary">{chunk.namespace}</span>}{' '}
          <span className="text-muted-foreground">
            id={chunk.elicitation?.elicitationId.slice(0, 8)}…
          </span>
        </li>
      );
    case 'error':
      return (
        <li className="rounded-md border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">
          <span className="font-mono text-muted-foreground">[{index}]</span> error{' '}
          <span className="text-error">{chunk.error}</span>
        </li>
      );
    case 'done':
      return (
        <li className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
          <span className="font-mono text-muted-foreground">[{index}]</span> done
        </li>
      );
    default:
      return (
        <li className="rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          <span className="font-mono text-muted-foreground">[{index}]</span> {String(chunk.type)}
        </li>
      );
  }
}
