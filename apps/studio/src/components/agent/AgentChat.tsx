/**
 * AgentChat  -  inline coding agent chat for Studio
 *
 * Streams responses from the agent-stream API endpoint. Supports admin and coding
 * modes with model selection. Renders tool call badges inline with text output.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettingsContext } from '../../hooks/use-settings';

// ── Types ────────────────────────────────────────────────────────────────────

interface AgentStreamChunk {
  type: 'text' | 'tool_call_start' | 'tool_call_result' | 'error' | 'done';
  content?: string;
  toolCall?: { name: string; arguments: string };
  toolResult?: { success: boolean; content?: string; error?: string };
  error?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: Array<{
    name: string;
    status: 'running' | 'success' | 'error';
    result?: string;
  }>;
}

type AgentMode = 'content' | 'coding';

// ── Tool labels ──────────────────────────────────────────────────────────────

const TOOL_LABELS: Record<string, string> = {
  file_read: 'Reading file',
  file_write: 'Writing file',
  file_edit: 'Editing file',
  file_glob: 'Finding files',
  file_grep: 'Searching code',
  shell_exec: 'Running command',
  git_ops: 'Git operation',
  project_context: 'Querying project',
  find_documents: 'Searching documents',
  get_document: 'Reading document',
  create_document: 'Creating document',
  update_document: 'Updating document',
  delete_document: 'Deleting document',
  list_collections: 'Listing collections',
};

// ── Streaming hook ───────────────────────────────────────────────────────────

function useAgentStream() {
  const [text, setText] = useState('');
  const [chunks, setChunks] = useState<AgentStreamChunk[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    controllerRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    setText('');
    setChunks([]);
    setIsStreaming(false);
    setError(null);
  }, []);

  const start = useCallback(
    async (
      instruction: string,
      apiBase: string,
      options?: { provider?: string; model?: string; mode?: AgentMode },
    ) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      setText('');
      setChunks([]);
      setIsStreaming(true);
      setError(null);

      try {
        const response = await fetch(`${apiBase}/api/agent-stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instruction,
            ...(options?.provider ? { provider: options.provider } : {}),
            ...(options?.model ? { model: options.model } : {}),
            ...(options?.mode ? { mode: options.mode } : {}),
          }),
          signal: controller.signal,
          credentials: 'include',
        });

        if (!response.ok) {
          const errText = await response.text();
          setIsStreaming(false);
          setError(`HTTP ${response.status}: ${errText}`);
          return;
        }

        if (!response.body) {
          setIsStreaming(false);
          setError('No response body');
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() ?? '';

          for (const event of events) {
            const dataLine = event.split('\n').find((l) => l.startsWith('data: '));
            if (!dataLine) continue;

            try {
              const chunk = JSON.parse(dataLine.slice(6)) as AgentStreamChunk;
              setChunks((prev) => [...prev, chunk]);
              if (chunk.type === 'text') setText((prev) => prev + (chunk.content ?? ''));
              if (chunk.type === 'error') setError(chunk.error ?? 'Unknown error');
              if (chunk.type === 'done' || chunk.type === 'error') setIsStreaming(false);
            } catch {
              // Malformed SSE data  -  skip
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          setIsStreaming(false);
          return;
        }
        setIsStreaming(false);
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [],
  );

  return { text, chunks, isStreaming, error, start, abort, reset };
}

// ── Tool call badge ──────────────────────────────────────────────────────────

function ToolBadge({
  name,
  status,
  result,
}: {
  name: string;
  status: 'running' | 'success' | 'error';
  result?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const label = TOOL_LABELS[name] ?? name;

  const statusColor =
    status === 'running'
      ? 'border-blue-600/40 bg-blue-950/30 text-blue-400'
      : status === 'success'
        ? 'border-emerald-600/40 bg-emerald-950/30 text-emerald-400'
        : 'border-red-600/40 bg-red-950/30 text-red-400';

  return (
    <div className="my-1">
      <button
        type="button"
        onClick={() => result && setExpanded(!expanded)}
        className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] font-medium ${statusColor} ${result ? 'cursor-pointer hover:brightness-110' : 'cursor-default'}`}
      >
        {status === 'running' ? (
          <span className="size-1.5 animate-pulse rounded-full bg-blue-400" />
        ) : null}
        {label}
      </button>
      {expanded && result ? (
        <pre className="mt-1 max-h-32 overflow-auto rounded border border-neutral-800 bg-neutral-950 p-2 text-[10px] text-neutral-400">
          {result}
        </pre>
      ) : null}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

let nextMsgId = 1;

export default function AgentChat() {
  const { settings } = useSettingsContext();
  const stream = useAgentStream();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<AgentMode>('coding');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeToolCalls = useRef<ChatMessage['toolCalls']>([]);

  // Track streaming response
  useEffect(() => {
    if (!stream.isStreaming && stream.text) {
      // Streaming finished  -  finalize assistant message
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return [...prev.slice(0, -1), { ...last, content: stream.text }];
        }
        return prev;
      });
      activeToolCalls.current = [];
    }
  }, [stream.isStreaming, stream.text]);

  // Update assistant message with streaming text + tool calls
  useEffect(() => {
    if (!stream.isStreaming && stream.chunks.length === 0) return;

    // Process latest chunks for tool calls
    for (const chunk of stream.chunks) {
      if (chunk.type === 'tool_call_start' && chunk.toolCall) {
        activeToolCalls.current = [
          ...(activeToolCalls.current ?? []),
          { name: chunk.toolCall.name, status: 'running' },
        ];
      }
      if (chunk.type === 'tool_call_result' && chunk.toolResult) {
        const tools = activeToolCalls.current ?? [];
        const lastRunning = [...tools].reverse().find((t) => t.status === 'running');
        if (lastRunning) {
          lastRunning.status = chunk.toolResult.success ? 'success' : 'error';
          lastRunning.result = chunk.toolResult.content ?? chunk.toolResult.error ?? '';
          activeToolCalls.current = [...tools];
        }
      }
    }

    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === 'assistant') {
        return [
          ...prev.slice(0, -1),
          { ...last, content: stream.text, toolCalls: [...(activeToolCalls.current ?? [])] },
        ];
      }
      return prev;
    });
  }, [stream.text, stream.chunks, stream.isStreaming]);

  // Auto-scroll on new messages
  const messageCount = messages.length;
  const lastContent = messages[messages.length - 1]?.content ?? '';
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on message count/content changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messageCount, lastContent]);

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      const content = input.trim();
      if (!content || stream.isStreaming) return;

      const userMsg: ChatMessage = { id: `msg-${nextMsgId++}`, role: 'user', content };
      const assistantMsg: ChatMessage = {
        id: `msg-${nextMsgId++}`,
        role: 'assistant',
        content: '',
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput('');
      activeToolCalls.current = [];

      stream.start(content, settings.apiUrl, { mode });
    },
    [input, stream, settings.apiUrl, mode],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === 'Escape' && stream.isStreaming) {
        e.preventDefault();
        stream.abort();
      }
    },
    [handleSubmit, stream],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-xs text-neutral-500">
                {mode === 'coding'
                  ? 'Ask about code, run commands, make changes...'
                  : 'Manage content, users, and settings...'}
              </p>
            </div>
          </div>
        ) : null}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-lg px-3 py-2 text-xs leading-relaxed ${
              msg.role === 'user'
                ? 'ml-8 bg-blue-950/40 text-blue-100'
                : 'mr-8 bg-neutral-800/60 text-neutral-200'
            }`}
          >
            {msg.role === 'assistant' && msg.toolCalls?.length ? (
              <div className="mb-1.5 flex flex-wrap gap-1">
                {msg.toolCalls.map((tc) => (
                  <ToolBadge key={`${msg.id}-tool-${tc.name}-${tc.status}`} {...tc} />
                ))}
              </div>
            ) : null}
            <div className="whitespace-pre-wrap">
              {msg.content || (msg.role === 'assistant' && stream.isStreaming ? '...' : '')}
            </div>
          </div>
        ))}

        {stream.error ? (
          <div className="rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-2 text-[11px] text-red-400">
            {stream.error}
          </div>
        ) : null}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-neutral-800 px-3 py-2.5">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex items-center rounded border border-neutral-700">
            <button
              type="button"
              onClick={() => setMode('coding')}
              disabled={stream.isStreaming}
              className={`rounded-l px-2 py-0.5 text-[10px] font-medium transition-colors ${
                mode === 'coding'
                  ? 'bg-blue-600 text-white'
                  : 'bg-neutral-800 text-neutral-500 hover:text-neutral-300'
              }`}
            >
              Coding
            </button>
            <button
              type="button"
              onClick={() => setMode('content')}
              disabled={stream.isStreaming}
              className={`rounded-r px-2 py-0.5 text-[10px] font-medium transition-colors ${
                mode === 'content'
                  ? 'bg-blue-600 text-white'
                  : 'bg-neutral-800 text-neutral-500 hover:text-neutral-300'
              }`}
            >
              admin
            </button>
          </div>
          <span className="text-[10px] text-neutral-600">
            {mode === 'coding' ? 'Code + admin tools' : 'admin tools only'}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={mode === 'coding' ? 'Ask about code...' : 'Ask the assistant...'}
            disabled={stream.isStreaming}
            className="flex-1 resize-none rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-xs text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-neutral-500"
          />
          {stream.isStreaming ? (
            <button
              type="button"
              onClick={stream.abort}
              className="shrink-0 rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-500"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-40"
            >
              Send
            </button>
          )}
        </form>
        <p className="mt-1.5 text-center text-[10px] text-neutral-600">
          Enter to send &middot; Shift+Enter for new line &middot; Esc to stop
        </p>
      </div>
    </div>
  );
}
