import type { ReactNode } from 'react';
import { StatusContext, useStatus } from '../../hooks/use-status';
import type { Page } from '../../types';
import Sidebar from './Sidebar';
import StatusBar from './StatusBar';

interface AppShellProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  children: ReactNode;
}

export default function AppShell({ currentPage, onNavigate, children }: AppShellProps) {
  const status = useStatus();

  return (
    <StatusContext.Provider value={status}>
      <div className="flex h-screen w-screen overflow-hidden">
        <Sidebar currentPage={currentPage} onNavigate={onNavigate} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
          <StatusBar />
        </div>
      </div>
    </StatusContext.Provider>
  );
}
