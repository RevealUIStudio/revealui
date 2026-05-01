'use client';

import { useEffect, useState } from 'react';
import AgentChat from '@/lib/components/Agent';
import { LicenseGate } from '@/lib/components/LicenseGate';

interface Conversation {
  id: string;
  title: string | null;
  updatedAt: string;
}

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarLoading, setSidebarLoading] = useState(true);
  const [sidebarError, setSidebarError] = useState<string | null>(null);

  // Fetch conversation list
  const loadConversations = async () => {
    setSidebarLoading(true);
    setSidebarError(null);
    try {
      const res = await fetch('/api/conversations');
      if (!res.ok) throw new Error('Failed to load conversations');
      const data = (await res.json()) as { conversations: Conversation[] };
      setConversations(data.conversations);
    } catch (e: unknown) {
      setSidebarError(e instanceof Error ? e.message : 'Unable to load conversations');
    } finally {
      setSidebarLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only fetch  -  loadConversations is a plain function that would cause infinite re-fetches if listed
  useEffect(() => {
    loadConversations();
  }, []);

  const handleNewChat = () => {
    setActiveId(null);
  };

  const handleSelectConversation = (id: string) => {
    setActiveId(id);
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) setActiveId(null);
    } catch {
      // Silently fail
    }
  };

  const handleConversationCreated = (id: string, _title: string) => {
    setActiveId(id);
    loadConversations();
  };

  return (
    <LicenseGate feature="aiLocal">
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar */}
        <div
          className={`${
            sidebarOpen ? 'w-64' : 'w-0'
          } flex shrink-0 flex-col overflow-hidden border-r border-zinc-200 bg-zinc-50 transition-all duration-200 dark:border-zinc-700 dark:bg-zinc-900`}
        >
          <div className="flex items-center justify-between border-b border-zinc-200 p-3 dark:border-zinc-700">
            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Conversations
            </span>
            <button
              type="button"
              onClick={handleNewChat}
              className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
            >
              New
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {sidebarLoading ? (
              <div className="space-y-1 p-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders
                    key={i}
                    className="animate-pulse rounded-md px-3 py-2.5"
                  >
                    <div
                      className="h-4 rounded bg-zinc-200 dark:bg-zinc-700"
                      style={{ width: `${60 + (i % 3) * 15}%` }}
                    />
                  </div>
                ))}
              </div>
            ) : sidebarError ? (
              <div className="p-3">
                <p className="text-center text-xs text-red-400">{sidebarError}</p>
                <button
                  type="button"
                  onClick={() => loadConversations()}
                  className="mt-2 w-full rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
                >
                  Retry
                </button>
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center px-3 py-8">
                <svg
                  className="mb-2 size-6 text-zinc-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"
                  />
                </svg>
                <p className="text-center text-xs text-zinc-400">No conversations yet</p>
                <p className="mt-1 text-center text-xs text-zinc-500">Start a new chat to begin</p>
              </div>
            ) : null}
            {!(sidebarLoading || sidebarError) &&
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`group flex cursor-pointer items-center justify-between border-b border-zinc-100 px-3 py-2.5 text-sm transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-800 ${
                    activeId === conv.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectConversation(conv.id)}
                    className="flex-1 truncate text-left text-zinc-700 dark:text-zinc-300"
                  >
                    {conv.title ?? 'Untitled'}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteConversation(conv.id);
                    }}
                    className="ml-2 hidden shrink-0 text-xs text-zinc-400 hover:text-red-500 group-hover:block"
                    aria-label="Delete conversation"
                  >
                    &#x2715;
                  </button>
                </div>
              ))}
          </div>
        </div>

        {/* Toggle sidebar */}
        <button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex w-6 shrink-0 items-center justify-center border-r border-zinc-200 bg-zinc-50 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          {sidebarOpen ? '\u2039' : '\u203A'}
        </button>

        {/* Chat area */}
        <div className="flex flex-1 flex-col">
          <AgentChat conversationId={activeId} onConversationCreated={handleConversationCreated} />
        </div>
      </div>
    </LicenseGate>
  );
}
