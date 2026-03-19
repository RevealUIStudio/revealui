import type { ReactNode } from 'react';
import { SettingsContext, useSettings } from '../../hooks/use-settings';
import { StatusContext, useStatus } from '../../hooks/use-status';
import type { Page } from '../../types';
import Sidebar from './Sidebar';
import StatusBar from './StatusBar';

interface AppShellProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  children: ReactNode;
  /** Removes padding and switches to overflow-hidden for full-bleed panels */
  padless?: boolean;
}

export default function AppShell({ currentPage, onNavigate, children, padless }: AppShellProps) {
  const status = useStatus();
  const settingsValue = useSettings();

  return (
    <SettingsContext.Provider value={settingsValue}>
      <StatusContext.Provider value={status}>
        <div className="flex h-screen w-screen overflow-hidden">
          <Sidebar currentPage={currentPage} onNavigate={onNavigate} />
          <div className="flex flex-1 flex-col overflow-hidden">
            <main className={`flex-1 ${padless ? 'overflow-hidden' : 'overflow-y-auto p-6'}`}>
              {children}
            </main>
            <StatusBar />
          </div>
        </div>
      </StatusContext.Provider>
    </SettingsContext.Provider>
  );
}
