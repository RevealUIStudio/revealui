'use client';

import type React from 'react';
import { createContext, use, useId, useRef, useState } from 'react';
import { cn } from '../utils/cn.js';

type TabsContextValue = {
  activeTab: string;
  setActiveTab: (id: string) => void;
  baseId: string;
};

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const ctx = use(TabsContext);
  if (!ctx) throw new Error('Tabs subcomponents must be used inside <Tabs>');
  return ctx;
}

export function Tabs({
  defaultTab,
  value,
  onChange,
  className,
  children,
}: {
  defaultTab?: string;
  value?: string;
  onChange?: (tab: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const baseId = useId();
  const [internalTab, setInternalTab] = useState(defaultTab ?? '');

  const activeTab = value ?? internalTab;
  const setActiveTab = (id: string) => {
    setInternalTab(id);
    onChange?.(id);
  };

  return (
    <TabsContext value={{ activeTab, setActiveTab, baseId }}>
      <div className={className}>{children}</div>
    </TabsContext>
  );
}

export function TabList({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!listRef.current) return;
    const tabs = Array.from(listRef.current.querySelectorAll<HTMLElement>('[role="tab"]'));
    const current = tabs.indexOf(document.activeElement as HTMLElement);
    if (current === -1) return;

    let next: number | undefined;
    if (e.key === 'ArrowRight') next = (current + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;

    if (next !== undefined) {
      e.preventDefault();
      tabs[next]?.focus();
      tabs[next]?.click();
    }
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      onKeyDown={handleKeyDown}
      className={cn('flex border-b border-zinc-200 dark:border-zinc-700', className)}
    >
      {children}
    </div>
  );
}

export function Tab({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { activeTab, setActiveTab, baseId } = useTabsContext();
  const isActive = activeTab === id;

  return (
    <button
      type="button"
      role="tab"
      id={`${baseId}-tab-${id}`}
      aria-controls={`${baseId}-panel-${id}`}
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      onClick={() => setActiveTab(id)}
      className={cn(
        className,
        'relative -mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500',
        isActive
          ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
          : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200',
      )}
    >
      {children}
    </button>
  );
}

export function TabPanel({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { activeTab, baseId } = useTabsContext();
  if (activeTab !== id) return null;

  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${id}`}
      aria-labelledby={`${baseId}-tab-${id}`}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: role="tabpanel" requires tabIndex=0 for keyboard nav per WAI-ARIA 1.2
      tabIndex={0}
      className={cn('focus-visible:outline-none', className)}
    >
      {children}
    </div>
  );
}
