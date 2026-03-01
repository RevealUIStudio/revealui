import type { Page } from '../../types'

interface SidebarProps {
  currentPage: Page
  onNavigate: (page: Page) => void
}

const NAV_ITEMS: { page: Page; label: string; icon: string }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: 'grid' },
  { page: 'devbox', label: 'DevBox', icon: 'hard-drive' },
  { page: 'sync', label: 'Sync', icon: 'refresh' },
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
    default:
      return <span className="size-4" />
  }
}
