import { Link, useLocation } from 'react-router-dom'
import { SearchBar } from './SearchBar'

interface DocLayoutProps {
  children?: React.ReactNode
}

interface NavItem {
  label: string
  path: string
  children?: NavItem[]
}

const navigation: NavItem[] = [
  { label: 'Home', path: '/' },
  {
    label: 'Getting Started',
    path: '/docs/QUICK_START',
    children: [
      { label: 'Quick Start', path: '/docs/QUICK_START' },
      { label: 'Build Your Business', path: '/docs/BUILD_YOUR_BUSINESS' },
      { label: 'Examples', path: '/docs/EXAMPLES' },
    ],
  },
  {
    label: 'Core Guides',
    path: '/docs/CMS_GUIDE',
    children: [
      { label: 'CMS Guide', path: '/docs/CMS_GUIDE' },
      { label: 'Authentication', path: '/docs/AUTH' },
      { label: 'Database', path: '/docs/DATABASE' },
      { label: 'CI/CD & Deployment', path: '/docs/CI_CD_GUIDE' },
      { label: 'Environment Variables', path: '/docs/ENVIRONMENT_VARIABLES_GUIDE' },
      { label: 'Testing', path: '/docs/TESTING' },
      { label: 'Troubleshooting', path: '/docs/TROUBLESHOOTING' },
    ],
  },
  {
    label: 'Architecture',
    path: '/docs/ARCHITECTURE',
    children: [
      { label: 'System Architecture', path: '/docs/ARCHITECTURE' },
      { label: 'Performance', path: '/docs/PERFORMANCE' },
      { label: 'Standards', path: '/docs/STANDARDS' },
      { label: 'Core Stability', path: '/docs/CORE_STABILITY' },
    ],
  },
  {
    label: 'Reference',
    path: '/docs/REFERENCE',
    children: [
      { label: 'Package Reference', path: '/docs/REFERENCE' },
      { label: 'Component Catalog', path: '/docs/COMPONENT_CATALOG' },
      { label: 'AI', path: '/docs/AI' },
      { label: 'Marketplace', path: '/docs/MARKETPLACE' },
    ],
  },
  {
    label: 'Pro & Enterprise',
    path: '/docs/PRO',
    children: [
      { label: 'Pro (AI, MCP, BYOK)', path: '/docs/PRO' },
      { label: 'Forge (Enterprise)', path: '/docs/FORGE' },
    ],
  },
  { label: 'Third-Party Licenses', path: '/docs/THIRD_PARTY_LICENSES' },
]

function NavLink({ item, depth = 0 }: { item: NavItem; depth?: number }) {
  const location = useLocation()
  const isActive = location.pathname === item.path
  const isParentActive = item.children?.some((child) => location.pathname === child.path)

  return (
    <li>
      <Link
        to={item.path}
        style={{
          fontWeight: isActive ? 'bold' : 'normal',
          color: isActive ? '#3b82f6' : 'inherit',
          display: 'block',
          padding: `4px 8px 4px ${depth * 12 + 8}px`,
          textDecoration: 'none',
          fontSize: depth > 0 ? '0.9em' : '1em',
        }}
      >
        {item.label}
      </Link>
      {item.children && (isParentActive || isActive) && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {item.children.map((child) => (
            <NavLink key={child.path} item={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}

export function DocLayout({ children }: DocLayoutProps) {
  return (
    <div className="docs-container">
      <nav className="docs-sidebar">
        <h2>
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            RevealUI Docs
          </Link>
        </h2>
        <div style={{ marginBottom: '1rem' }}>
          <SearchBar />
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {navigation.map((item) => (
            <NavLink key={`${item.label}-${item.path}`} item={item} />
          ))}
        </ul>
        <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
          <a
            href="https://github.com/RevealUIStudio/revealui"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#6b7280',
              textDecoration: 'none',
              fontSize: '0.875rem',
            }}
          >
            <svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <title>GitHub</title>
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            GitHub
          </a>
        </div>
      </nav>
      <main className="docs-content">{children}</main>
    </div>
  )
}
