'use client';

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AgentStreamChunk {
  type: 'text' | 'tool_call_start' | 'tool_call_result' | 'error' | 'done';
  content?: string;
  toolCall?: { name: string; arguments: string };
  toolResult?: { success?: boolean; data?: unknown; error?: string };
  error?: string;
  metadata?: { tokensUsed?: number; executionTime?: number };
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCallEntry[];
}

interface PendingConfirmation {
  toolCallId: string;
  toolName: string;
  arguments: unknown;
  description: string;
  pendingMessages: Array<{ role: string; content: string }>;
}

interface ToolCallEntry {
  name: string;
  arguments: string;
  status: 'running' | 'success' | 'error';
  result?: string;
}

// ─── Model Options ──────────────────────────────────────────────────────────

interface ModelOption {
  id: string;
  label: string;
  provider: string;
  model: string;
}

const MODEL_OPTIONS: ModelOption[] = [
  { id: 'auto', label: 'Auto', provider: '', model: '' },
  { id: 'local', label: 'Ollama (Local)', provider: 'ollama', model: '' },
  {
    id: 'gemma-27b',
    label: 'Gemma 4 27B (Cloud)',
    provider: 'huggingface',
    model: 'google/gemma-4-27b-it',
  },
];

// ─── Constants ──────────────────────────────────────────────────────────────

const API_URL =
  (typeof window !== 'undefined'
    ? (document.querySelector('meta[name="api-url"]') as HTMLMetaElement)?.content
    : undefined) ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://api.revealui.com';

const SUGGESTED_PROMPTS = [
  'Show me all published posts',
  'Create a new blog post about our latest update',
  'List all users and their roles',
  'Update the site header navigation',
  'How many media files do we have?',
];

type AgentMode = 'cms' | 'coding';

const TOOL_LABELS: Record<string, string> = {
  // CMS tools
  find_documents: 'Searching documents',
  get_document: 'Reading document',
  create_document: 'Creating document',
  update_document: 'Updating document',
  delete_document: 'Deleting document',
  list_collections: 'Listing collections',
  list_globals: 'Listing globals',
  get_global: 'Reading global',
  update_global: 'Updating global',
  list_media: 'Browsing media',
  get_media: 'Reading media',
  upload_media: 'Uploading media',
  update_media: 'Updating media',
  delete_media: 'Deleting media',
  list_users: 'Listing users',
  get_current_user: 'Getting your info',
  create_user: 'Creating user',
  update_user: 'Updating user',
  delete_user: 'Deleting user',
  // Coding tools
  file_read: 'Reading file',
  file_write: 'Writing file',
  file_edit: 'Editing file',
  file_glob: 'Finding files',
  file_grep: 'Searching code',
  shell_exec: 'Running command',
  git_ops: 'Git operation',
  project_context: 'Querying project',
};

const SUGGESTED_PROMPTS_CODING = [
  'Show me the project structure',
  'Find all TODO comments in the codebase',
  'Read the main configuration file',
  'Run the test suite',
  'Show recent git changes',
];

// ─── Streaming Hook (inline — avoids Pro package import boundary) ───────────

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
          setIsStreaming(false);
          const status = response.status;
          if (status === 401) {
            setError('Session expired — please sign in again');
          } else if (status === 403) {
            setError('AI features require a Pro subscription');
          } else if (status === 429) {
            setError('Rate limit exceeded — please wait a moment');
          } else if (status === 503) {
            setError('AI service unavailable — check your inference configuration');
          } else {
            setError(`Request failed (${status})`);
          }
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
              // Malformed SSE data — skip
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

// ─── Sub-components ─────────────────────────────────────────────────────────

function ToolCallBadge({ entry }: { entry: ToolCallEntry }) {
  const [expanded, setExpanded] = useState(false);
  const label = TOOL_LABELS[entry.name] ?? entry.name;

  return (
    <div className="my-1.5 rounded-md border border-zinc-200 bg-zinc-50 text-sm dark:border-zinc-700 dark:bg-zinc-800/50">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left"
      >
        {entry.status === 'running' && (
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-400 border-t-blue-500" />
        )}
        {entry.status === 'success' && <span className="text-emerald-500">&#10003;</span>}
        {entry.status === 'error' && <span className="text-red-500">&#10007;</span>}
        <span className="font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
        <span className="ml-auto text-xs text-zinc-400">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="border-t border-zinc-200 px-3 py-2 dark:border-zinc-700">
          {entry.arguments && (
            <pre className="mb-1 max-h-32 overflow-auto rounded bg-zinc-100 p-2 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              {formatJson(entry.arguments)}
            </pre>
          )}
          {entry.result && (
            <pre className="max-h-32 overflow-auto rounded bg-zinc-100 p-2 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              {entry.result}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function ChatMarkdown({ content }: { content: string }) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ children, href, ...props }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 underline hover:text-blue-300"
            {...props}
          >
            {children}
          </a>
        ),
        code: ({ children, className, ...props }) => {
          const isBlock = className?.startsWith('language-');
          if (isBlock) {
            return (
              <pre className="my-2 overflow-x-auto rounded-md bg-zinc-900 p-3 text-sm text-zinc-100">
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            );
          }
          return (
            <code className="rounded bg-zinc-200 px-1 py-0.5 text-sm dark:bg-zinc-700" {...props}>
              {children}
            </code>
          );
        },
        table: ({ children, ...props }) => (
          <div className="my-2 overflow-x-auto">
            <table className="min-w-full text-sm" {...props}>
              {children}
            </table>
          </div>
        ),
        th: ({ children, ...props }) => (
          <th
            className="border-b border-zinc-300 px-3 py-1 text-left font-semibold dark:border-zinc-600"
            {...props}
          >
            {children}
          </th>
        ),
        td: ({ children, ...props }) => (
          <td className="border-b border-zinc-200 px-3 py-1 dark:border-zinc-700" {...props}>
            {children}
          </td>
        ),
      }}
    >
      {content}
    </Markdown>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="mt-1 self-start rounded px-1.5 py-0.5 text-xs text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-200 hover:text-zinc-600 group-hover:opacity-100 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
      aria-label="Copy message"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function MessageSkeleton() {
  return (
    <div className="flex animate-pulse gap-3">
      <div className="h-8 w-8 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-700" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-3 w-3/4 rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-3 w-1/2 rounded bg-zinc-200 dark:bg-zinc-700" />
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`group flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white'
        }`}
      >
        {isUser ? 'U' : 'AI'}
      </div>
      <div className={`flex max-w-[85%] flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-blue-600 text-white'
              : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              {message.toolCalls?.map((tc) => (
                <ToolCallBadge key={`${tc.name}-${tc.arguments.slice(0, 20)}`} entry={tc} />
              ))}
              <ChatMarkdown content={message.content} />
            </div>
          )}
        </div>
        {!isUser && <CopyButton text={message.content} />}
      </div>
    </div>
  );
}

function ConfirmationCard({
  confirmation,
  onApprove,
  onReject,
  isLoading,
}: {
  confirmation: PendingConfirmation;
  onApprove: () => void;
  onReject: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="mx-auto my-4 max-w-md rounded-xl border-2 border-amber-300 bg-amber-50 p-4 dark:border-amber-600 dark:bg-amber-900/20">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-lg">&#x26A0;&#xFE0F;</span>
        <span className="font-semibold text-amber-800 dark:text-amber-300">
          Confirmation Required
        </span>
      </div>
      <p className="mb-3 text-sm text-amber-700 dark:text-amber-400">{confirmation.description}</p>
      <details className="mb-3">
        <summary className="cursor-pointer text-xs text-amber-600 dark:text-amber-500">
          View details
        </summary>
        <pre className="mt-1 max-h-24 overflow-auto rounded bg-amber-100 p-2 text-xs dark:bg-amber-900/40">
          {formatJson(JSON.stringify(confirmation.arguments))}
        </pre>
      </details>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onApprove}
          disabled={isLoading}
          className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
        >
          {isLoading ? 'Executing...' : 'Approve'}
        </button>
        <button
          type="button"
          onClick={onReject}
          disabled={isLoading}
          className="flex-1 rounded-lg bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
        >
          Reject
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

let messageCounter = 0;
function nextId(): string {
  return `msg-${++messageCounter}-${Date.now()}`;
}

function formatJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

interface AgentChatProps {
  conversationId?: string | null;
  onConversationCreated?: (id: string, title: string) => void;
}

export default function AgentChat({ conversationId, onConversationCreated }: AgentChatProps = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('auto');
  const [agentMode, setAgentMode] = useState<AgentMode>('cms');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    conversationId ?? null,
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastFailedInput = useRef<string | null>(null);

  const stream = useAgentStream();

  // Load conversation messages when conversationId changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: stream.reset is stable, only re-run on conversationId change
  useEffect(() => {
    if (conversationId === undefined) return;
    setActiveConversationId(conversationId);
    setPendingConfirmation(null);
    stream.reset();
    activeToolCalls.current = [];

    if (!conversationId) {
      setMessages([]);
      return;
    }

    setIsLoadingHistory(true);
    (async () => {
      try {
        const res = await fetch(`/api/conversations/${conversationId}/messages`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          messages: Array<{ id: string; role: string; content: string }>;
        };
        setMessages(
          data.messages.map((m) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
        );
      } catch {
        setMessages([]);
      } finally {
        setIsLoadingHistory(false);
      }
    })();
  }, [conversationId]);

  /** Persist a message to the active conversation */
  const persistMessage = useCallback(
    async (role: string, content: string) => {
      if (!activeConversationId) return;
      try {
        await fetch(`/api/conversations/${activeConversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role, content }),
        });
      } catch {
        // Fire-and-forget — don't block the UI
      }
    },
    [activeConversationId],
  );

  /** Create a new conversation on first message */
  const ensureConversation = useCallback(
    async (firstMessage: string): Promise<string | null> => {
      if (activeConversationId) return activeConversationId;
      try {
        const title = firstMessage.slice(0, 60) + (firstMessage.length > 60 ? '...' : '');
        const res = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title }),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { conversation: { id: string } };
        const newId = data.conversation.id;
        setActiveConversationId(newId);
        onConversationCreated?.(newId, title);
        return newId;
      } catch {
        return null;
      }
    },
    [activeConversationId, onConversationCreated],
  );

  // Auto-scroll on new content — deps are intentionally broad to trigger on any update
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll must fire on every message/chunk change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, stream.text, stream.chunks]);

  // Build active tool calls from stream chunks
  const activeToolCalls = useRef<ToolCallEntry[]>([]);

  useEffect(() => {
    const lastChunk = stream.chunks[stream.chunks.length - 1];
    if (!lastChunk) return;

    if (lastChunk.type === 'tool_call_start' && lastChunk.toolCall) {
      activeToolCalls.current = [
        ...activeToolCalls.current,
        {
          name: lastChunk.toolCall.name,
          arguments: lastChunk.toolCall.arguments,
          status: 'running',
        },
      ];
    }

    if (lastChunk.type === 'tool_call_result') {
      const result = lastChunk.toolResult as
        | { success?: boolean; data?: unknown; error?: string }
        | undefined;
      const updated = [...activeToolCalls.current];
      // Update the last running tool call
      const lastRunning = updated.findLastIndex((tc) => tc.status === 'running');
      const existing = lastRunning >= 0 ? updated[lastRunning] : undefined;
      if (lastRunning >= 0 && existing) {
        updated[lastRunning] = {
          name: existing.name,
          arguments: existing.arguments,
          status: result?.success !== false ? 'success' : 'error',
          result: result?.error ?? JSON.stringify(result?.data ?? '').slice(0, 500),
        };
        activeToolCalls.current = updated;
      }
    }
  }, [stream.chunks]);

  // When stream finishes, commit the assistant message + persist
  useEffect(() => {
    if (!stream.isStreaming && stream.text) {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: 'assistant',
          content: stream.text,
          toolCalls: activeToolCalls.current.length > 0 ? [...activeToolCalls.current] : undefined,
        },
      ]);
      persistMessage('assistant', stream.text);
      activeToolCalls.current = [];
      stream.reset();
    }
  }, [stream.isStreaming, stream.text, stream.reset, persistMessage]);

  /** Send message via /api/chat (CMS tools, confirmation support) */
  const sendChatMessage = useCallback(
    async (allMessages: ChatMessage[], confirmedToolCalls?: string[]) => {
      stream.reset();
      const chatMessages = allMessages.map(({ role, content }) => ({ role, content }));

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: chatMessages,
            ...(confirmedToolCalls ? { confirmedToolCalls } : {}),
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Chat failed: ${res.status} ${text}`);
        }

        const data = await res.json();

        // Handle confirmation_required response
        if (data.type === 'confirmation_required') {
          setPendingConfirmation({
            toolCallId: data.toolCallId,
            toolName: data.toolName,
            arguments: data.arguments,
            description: data.description,
            pendingMessages: data.pendingMessages ?? [],
          });
          return;
        }

        // Normal response
        setMessages((prev) => [
          ...prev,
          { id: nextId(), role: 'assistant', content: data.content ?? '' },
        ]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'assistant',
            content: `Error: ${msg}. Contact support@revealui.com if this persists.`,
          },
        ]);
      }
    },
    [stream],
  );

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const content = input.trim();
      if (!content || stream.isStreaming || isConfirming) return;

      setMessages((prev) => [...prev, { id: nextId(), role: 'user', content }]);
      lastFailedInput.current = content;
      setInput('');
      // Reset textarea height
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      setPendingConfirmation(null);
      activeToolCalls.current = [];

      // Ensure conversation exists (creates on first message)
      await ensureConversation(content);
      persistMessage('user', content);

      // Use streaming endpoint with selected model and mode
      const opt = MODEL_OPTIONS.find((m) => m.id === selectedModel);
      stream.start(content, API_URL, {
        ...(opt?.provider ? { provider: opt.provider, model: opt.model } : {}),
        mode: agentMode,
      });
    },
    [input, stream, isConfirming, ensureConversation, persistMessage, selectedModel, agentMode],
  );

  const handleConfirmApprove = useCallback(async () => {
    if (!pendingConfirmation) return;
    setIsConfirming(true);

    // Re-send the same conversation with the confirmed tool call ID
    await sendChatMessage(messages, [pendingConfirmation.toolCallId]);

    setPendingConfirmation(null);
    setIsConfirming(false);
  }, [pendingConfirmation, messages, sendChatMessage]);

  const handleConfirmReject = useCallback(() => {
    if (!pendingConfirmation) return;

    setMessages((prev) => [
      ...prev,
      {
        id: nextId(),
        role: 'assistant',
        content: `Cancelled: ${pendingConfirmation.description}. No changes were made.`,
      },
    ]);
    setPendingConfirmation(null);
  }, [pendingConfirmation]);

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

  // Auto-resize textarea
  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  const handleRetry = useCallback(() => {
    if (!lastFailedInput.current) return;
    setInput(lastFailedInput.current);
    lastFailedInput.current = null;
    textareaRef.current?.focus();
  }, []);

  const handleSuggestedPrompt = useCallback((prompt: string) => {
    setInput(prompt);
    // Focus the textarea so user can edit or just hit enter
    textareaRef.current?.focus();
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* Messages area */}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-6">
        {isLoadingHistory && (
          <div className="space-y-4">
            <MessageSkeleton />
            <MessageSkeleton />
            <MessageSkeleton />
          </div>
        )}

        {messages.length === 0 && !stream.isStreaming && !isLoadingHistory && (
          <div className="flex h-full flex-col items-center justify-center gap-6">
            <div className="text-center">
              <div className="mb-2 text-4xl">&#x1F916;</div>
              <h2 className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">
                CMS Assistant
              </h2>
              <p className="mt-1 max-w-md text-sm text-zinc-500">
                {agentMode === 'coding'
                  ? 'I can help you read, write, and search code, run commands, and manage your project. Try a suggestion below.'
                  : 'I can help you manage content, users, media, and settings. Ask me anything or try one of the suggestions below.'}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {(agentMode === 'coding' ? SUGGESTED_PROMPTS_CODING : SUGGESTED_PROMPTS).map(
                (prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handleSuggestedPrompt(prompt)}
                    className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-blue-600 dark:hover:bg-zinc-700"
                  >
                    {prompt}
                  </button>
                ),
              )}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Streaming assistant message (in progress) */}
        {stream.isStreaming && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-medium text-white">
              AI
            </div>
            <div className="max-w-[85%] rounded-2xl bg-zinc-100 px-4 py-3 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
              <div className="prose prose-sm max-w-none dark:prose-invert">
                {activeToolCalls.current.map((tc) => (
                  <ToolCallBadge key={`${tc.name}-${tc.arguments.slice(0, 20)}`} entry={tc} />
                ))}
                {stream.text ? (
                  <ChatMarkdown content={stream.text} />
                ) : (
                  <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-violet-500" />
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-violet-500 [animation-delay:150ms]" />
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-violet-500 [animation-delay:300ms]" />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {pendingConfirmation && (
          <ConfirmationCard
            confirmation={pendingConfirmation}
            onApprove={handleConfirmApprove}
            onReject={handleConfirmReject}
            isLoading={isConfirming}
          />
        )}

        {stream.error && !stream.isStreaming && (
          <div className="mx-auto max-w-md rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            <p className="font-medium">Something went wrong</p>
            <p className="mt-1 text-xs">{stream.error}</p>
            <div className="mt-3 flex items-center gap-3">
              {lastFailedInput.current && (
                <button
                  type="button"
                  onClick={handleRetry}
                  className="rounded-md bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60"
                >
                  Retry
                </button>
              )}
              <p className="text-xs text-red-500">Contact support@revealui.com if this persists.</p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-zinc-200 bg-white px-3 py-3 sm:px-4 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mx-auto mb-2 flex max-w-3xl items-center gap-2">
          <div className="flex items-center rounded-md border border-zinc-200 dark:border-zinc-700">
            <button
              type="button"
              onClick={() => setAgentMode('cms')}
              disabled={stream.isStreaming}
              className={`rounded-l-md px-2.5 py-1 text-xs font-medium transition-colors ${
                agentMode === 'cms'
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-50 text-zinc-500 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
              }`}
            >
              CMS
            </button>
            <button
              type="button"
              onClick={() => setAgentMode('coding')}
              disabled={stream.isStreaming}
              className={`rounded-r-md px-2.5 py-1 text-xs font-medium transition-colors ${
                agentMode === 'coding'
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-50 text-zinc-500 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
              }`}
            >
              Coding
            </button>
          </div>
          <label htmlFor="model-select" className="text-xs text-zinc-400">
            Model
          </label>
          <select
            id="model-select"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={stream.isStreaming}
            className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-600 outline-none focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          >
            {MODEL_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
          {selectedModel !== 'auto' && (
            <span className="hidden text-xs text-zinc-400 sm:inline">
              {MODEL_OPTIONS.find((m) => m.id === selectedModel)?.model || 'default'}
            </span>
          )}
        </div>
        <form onSubmit={handleSubmit} className="mx-auto flex max-w-3xl items-end gap-2 sm:gap-3">
          <textarea
            ref={textareaRef}
            className="flex-1 resize-none rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 sm:px-4 sm:py-3 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={
              agentMode === 'coding'
                ? 'Ask about code, run commands, make changes...'
                : 'Ask the assistant...'
            }
            disabled={stream.isStreaming || !!pendingConfirmation}
          />
          {stream.isStreaming ? (
            <button
              type="button"
              onClick={stream.abort}
              className="shrink-0 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-600 sm:px-5 sm:py-3"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="shrink-0 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40 sm:px-5 sm:py-3"
            >
              Send
            </button>
          )}
        </form>
        <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-zinc-400">
          Enter to send &middot; Shift+Enter for new line &middot; Esc to stop &middot; AI may make
          mistakes
        </p>
      </div>
    </div>
  );
}
