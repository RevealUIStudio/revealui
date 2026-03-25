'use client';

import { useCallback, useEffect, useState } from 'react';
import AgentChat from '@/lib/components/Agent';
import { LicenseGate } from '@/lib/components/LicenseGate';

export const dynamic = 'force-dynamic';

interface Conversation {
  id: string;
  title: string | null;
  updatedAt: string;
}

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Fetch conversation list
  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations');
      if (!res.ok) return;
      const data = (await res.json()) as { conversations: Conversation[] };
      setConversations(data.conversations);
    } catch {
      // Silently fail — sidebar will be empty
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const handleNewChat = useCallback(() => {
    setActiveId(null);
  }, []);

  const handleSelectConversation = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (activeId === id) setActiveId(null);
      } catch {
        // Silently fail
      }
    },
    [activeId],
  );

  const handleConversationCreated = useCallback(
    (id: string, _title: string) => {
      setActiveId(id);
      loadConversations();
    },
    [loadConversations],
  );

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
            {conversations.length === 0 && (
              <p className="p-3 text-center text-xs text-zinc-400">No conversations yet</p>
            )}
            {conversations.map((conv) => (
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
