import type { Page } from '../../types'

interface SidebarProps {
  currentPage: Page
  onNavigate: (page: Page) => void
}

const NAV_ITEMS: { page: Page; label: string; icon: string }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: 'grid' },
  { page: 'vault', label: 'Vault', icon: 'lock' },
  { page: 'infrastructure', label: 'Infrastructure', icon: 'server' },
  { page: 'sync', label: 'Sync', icon: 'refresh' },
  { page: 'tunnel', label: 'Tunnel', icon: 'globe' },
  { page: 'setup', label: 'Setup', icon: 'settings' },
]

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
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
    case 'lock':
      return (
        <svg
          className="size-4"
          aria-hidden="true"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      )
    case 'server':
      return (
        <svg
          className="size-4"
          aria-hidden="true"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
          <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
          <line x1="6" x2="6" y1="6" y2="6" />
          <line x1="6" x2="6" y1="18" y2="18" />
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
    case 'globe':
      return (
        <svg
          className="size-4"
          aria-hidden="true"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="2" x2="22" y1="12" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
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
