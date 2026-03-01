import type { ReactNode } from 'react'
import type { Page } from '../../types'
import Sidebar from './Sidebar'
import StatusBar from './StatusBar'

interface AppShellProps {
  currentPage: Page
  onNavigate: (page: Page) => void
  onSetup: () => void
  children: ReactNode
}

export default function AppShell({ currentPage, onNavigate, onSetup, children }: AppShellProps) {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar currentPage={currentPage} onNavigate={onNavigate} onSetup={onSetup} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
        <StatusBar />
      </div>
    </div>
  )
}
