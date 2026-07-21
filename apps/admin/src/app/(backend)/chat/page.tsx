'use client';

import {
  Button,
  EmptyState,
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconGlobe,
  Skeleton,
} from '@revealui/presentation';
import { useConversations } from '@revealui/sync';
import { useState } from 'react';
import AgentChat from '@/lib/components/Agent';
import { LicenseGate } from '@/lib/components/LicenseGate';

export default function ChatPage() {
  const {
    conversations,
    isLoading: sidebarLoading,
    error: sidebarError,
    remove,
  } = useConversations();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleNewChat = () => {
    setActiveId(null);
  };

  const handleSelectConversation = (id: string) => {
    setActiveId(id);
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await remove(id);
      if (activeId === id) setActiveId(null);
    } catch {
      // Silently fail
    }
  };

  const handleConversationCreated = (id: string, _title: string) => {
    setActiveId(id);
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
            <Button type="button" variant="brand" size="sm" onClick={handleNewChat}>
              New
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {sidebarLoading ? (
              <div className="space-y-1 p-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders
                    key={i}
                    className="rounded-md px-3 py-2.5"
                  >
                    <Skeleton className="h-4" style={{ width: `${60 + (i % 3) * 15}%` }} />
                  </div>
                ))}
              </div>
            ) : sidebarError ? (
              <div className="p-3">
                <p className="text-center text-xs text-red-400">
                  {sidebarError instanceof Error ? sidebarError.message : String(sidebarError)}
                </p>
              </div>
            ) : conversations.length === 0 ? (
              <EmptyState
                icon={<IconGlobe className="size-6 text-zinc-400" aria-hidden="true" />}
                title="No conversations yet"
                description="Start a new chat to begin"
                className="border-0 py-8"
              />
            ) : null}
            {!(sidebarLoading || sidebarError) &&
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`group flex cursor-pointer items-center justify-between border-b border-zinc-100 px-3 py-2.5 text-sm transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-800 ${
                    activeId === conv.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <Button
                    type="button"
                    appearance="ghost"
                    variant="neutral"
                    onClick={() => handleSelectConversation(conv.id)}
                    className="h-auto flex-1 justify-start truncate px-0 py-0 text-left text-zinc-700 hover:bg-transparent dark:text-zinc-300"
                  >
                    {conv.title ?? 'Untitled'}
                  </Button>
                  <Button
                    type="button"
                    appearance="ghost"
                    variant="neutral"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteConversation(conv.id);
                    }}
                    className="ml-2 hidden size-6 shrink-0 text-zinc-400 hover:text-red-500 group-hover:inline-flex"
                    aria-label="Delete conversation"
                  >
                    <IconClose size="xs" />
                  </Button>
                </div>
              ))}
          </div>
        </div>

        {/* Toggle sidebar */}
        <Button
          type="button"
          appearance="ghost"
          variant="neutral"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="h-auto w-6 shrink-0 rounded-none border-r border-zinc-200 bg-zinc-50 px-0 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          {sidebarOpen ? <IconChevronLeft size="sm" /> : <IconChevronRight size="sm" />}
        </Button>

        {/* Chat area */}
        <div className="flex flex-1 flex-col">
          <AgentChat conversationId={activeId} onConversationCreated={handleConversationCreated} />
        </div>
      </div>
    </LicenseGate>
  );
}
