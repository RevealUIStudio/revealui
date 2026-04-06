import { useState } from 'react';
import type { HarnessMessage, HarnessSession } from '../../types';

interface MessageInboxProps {
  messages: HarnessMessage[];
  sessions: HarnessSession[];
  agentId: string;
  onSend: (toAgent: string, subject: string, body: string) => Promise<void>;
  onMarkRead: (messageIds: number[]) => Promise<void>;
}

export default function MessageInbox({
  messages,
  sessions,
  agentId,
  onSend,
  onMarkRead,
}: MessageInboxProps) {
  const [composing, setComposing] = useState(false);
  const [toAgent, setToAgent] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const unreadCount = messages.filter((m) => !m.read).length;

  async function handleSend(): Promise<void> {
    if (!(toAgent.trim() && subject.trim())) return;
    setSending(true);
    try {
      await onSend(toAgent.trim(), subject.trim(), body.trim());
      setComposing(false);
      setToAgent('');
      setSubject('');
      setBody('');
    } finally {
      setSending(false);
    }
  }

  async function handleMarkAllRead(): Promise<void> {
    const unreadIds = messages.filter((m) => !m.read).map((m) => m.id);
    if (unreadIds.length > 0) await onMarkRead(unreadIds);
  }

  function relativeTime(iso: string): string {
    const ts = Date.parse(iso);
    if (Number.isNaN(ts)) return iso;
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-neutral-800 px-3 py-2">
        <span className="text-xs font-semibold text-neutral-200">Messages</span>
        {unreadCount > 0 ? (
          <span className="rounded-full bg-blue-600/20 px-1.5 py-0.5 text-[10px] font-medium text-blue-400">
            {unreadCount} unread
          </span>
        ) : null}
        <div className="ml-auto flex gap-1">
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={() => void handleMarkAllRead()}
              className="rounded px-2 py-1 text-[10px] text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
            >
              Mark all read
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setComposing(!composing)}
            className="rounded bg-blue-600/20 px-2 py-1 text-[10px] font-medium text-blue-400 hover:bg-blue-600/30"
          >
            {composing ? 'Cancel' : 'Compose'}
          </button>
        </div>
      </div>

      {/* Compose form */}
      {composing ? (
        <div className="border-b border-neutral-800 bg-neutral-900/50 p-3">
          <div className="mb-2 flex gap-2">
            <select
              value={toAgent}
              onChange={(e) => setToAgent(e.target.value)}
              className="flex-1 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-neutral-200 focus:border-neutral-500 focus:outline-none"
            >
              <option value="">To agent…</option>
              {sessions
                .filter((s) => s.id !== agentId && !s.ended_at)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id}
                  </option>
                ))}
            </select>
          </div>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="mb-2 w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-neutral-200 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Message body…"
            rows={3}
            className="mb-2 w-full resize-none rounded border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending || !toAgent.trim() || !subject.trim()}
            className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-40"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      ) : null}

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-xs text-neutral-600">No messages</p>
        ) : null}
        <div className="flex flex-col gap-1">
          {messages.map((msg) => {
            const isExpanded = expanded === msg.id;
            const isIncoming = msg.to_agent === agentId;
            return (
              <button
                type="button"
                key={msg.id}
                onClick={() => {
                  setExpanded(isExpanded ? null : msg.id);
                  if (!msg.read && isIncoming) void onMarkRead([msg.id]);
                }}
                className={`w-full rounded-lg border p-2.5 text-left transition-colors ${
                  msg.read
                    ? 'border-neutral-800 bg-neutral-900/40'
                    : 'border-blue-800/40 bg-blue-950/20'
                } hover:bg-neutral-800/50`}
              >
                <div className="flex items-center gap-2">
                  {!msg.read ? (
                    <span className="size-1.5 shrink-0 rounded-full bg-blue-500" />
                  ) : null}
                  <span className="text-[10px] font-medium text-neutral-400">
                    {isIncoming ? `from ${msg.from_agent}` : `to ${msg.to_agent}`}
                  </span>
                  <span className="ml-auto text-[10px] text-neutral-600">
                    {relativeTime(msg.created_at)}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs font-medium text-neutral-200">{msg.subject}</p>
                {isExpanded ? (
                  <p className="mt-1.5 whitespace-pre-wrap text-[11px] leading-relaxed text-neutral-400">
                    {msg.body}
                  </p>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
