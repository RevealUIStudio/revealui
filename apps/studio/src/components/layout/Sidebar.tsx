import type { Page } from '../../types'

interface SidebarProps {
  currentPage: Page
  onNavigate: (page: Page) => void
  onSetup: () => void
}

const NAV_ITEMS: { page: Page; label: string; icon: string }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: 'grid' },
  { page: 'apps', label: 'App Launcher', icon: 'rocket' },
  { page: 'devbox', label: 'DevBox', icon: 'hard-drive' },
  { page: 'sync', label: 'Sync', icon: 'refresh' },
]

export default function Sidebar({ currentPage, onNavigate, onSetup }: SidebarProps) {
  return (
    <aside className="flex w-56 flex-col border-r border-neutral-800 bg-neutral-900">
      <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-4">
        <div className="size-8 rounded-lg bg-orange-600 flex items-center justify-center text-sm font-bold">
          R
        </div>
        <span className="text-sm font-semibold">RevealUI Studio</span>
      </div>
      <nav className="flex-1 px-2 py-3">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.page}
            type="button"
            onClick={() => onNavigate(item.page)}
            className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
              currentPage === item.page
                ? 'bg-neutral-800 text-neutral-100'
                : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'
            }`}
          >
            <NavIcon name={item.icon} />
            {item.label}
          </button>
        ))}
      </nav>
      <div className="border-t border-neutral-800 px-2 py-3">
        <button
          type="button"
          onClick={onSetup}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-neutral-400 transition-colors hover:bg-neutral-800/50 hover:text-neutral-200"
        >
          <NavIcon name="settings" />
          Setup
        </button>
      </div>
    </aside>
  )
}

function NavIcon({ name }: { name: string }) {
  switch (name) {
    case 'grid':
      return (
        <svg
          className="size-4"
          aria-hidden="true"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M4 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5ZM14 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V5ZM4 15a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4ZM14 15a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4Z" />
        </svg>
      )
    case 'hard-drive':
      return (
        <svg
          className="size-4"
          aria-hidden="true"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M2 17h20M2 17a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2M2 17l3.5-10.5A2 2 0 0 1 7.4 5h9.2a2 2 0 0 1 1.9 1.5L22 17M6 17.5a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1ZM18 17.5a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1Z" />
        </svg>
      )
    case 'refresh':
      return (
        <svg
          className="size-4"
          aria-hidden="true"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M4 4v5h5M20 20v-5h-5" />
          <path d="M20.49 9A9 9 0 0 0 5.64 5.64L4 7m16 10l-1.64 1.36A9 9 0 0 1 3.51 15" />
        </svg>
      )
    case 'rocket':
      return (
        <svg
          className="size-4"
          aria-hidden="true"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09Z" />
          <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2Z" />
          <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
          <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
        </svg>
      )
    case 'settings':
      return (
        <svg
          className="size-4"
          aria-hidden="true"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )
    default:
      return <span className="size-4" />
  }
}
