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

interface NavSection {
  title: string
  items: NavItem[]
}

const sections: NavSection[] = [
  {
    title: 'Getting Started',
    items: [
      { label: 'Quick Start', path: '/docs/QUICK_START' },
      { label: 'Build Your Business', path: '/docs/BUILD_YOUR_BUSINESS' },
      { label: 'Examples', path: '/docs/EXAMPLES' },
    ],
  },
  {
    title: 'Core Guides',
    items: [
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
    title: 'Architecture',
    items: [
      { label: 'System Architecture', path: '/docs/ARCHITECTURE' },
      { label: 'Performance', path: '/docs/PERFORMANCE' },
      { label: 'Standards', path: '/docs/STANDARDS' },
      { label: 'Core Stability', path: '/docs/CORE_STABILITY' },
    ],
  },
  {
    title: 'Reference',
    items: [
      { label: 'Package Reference', path: '/docs/REFERENCE' },
      { label: 'Component Catalog', path: '/docs/COMPONENT_CATALOG' },
      { label: 'AI', path: '/docs/AI' },
      { label: 'Marketplace', path: '/docs/MARKETPLACE' },
    ],
  },
  {
    title: 'Pro & Enterprise',
    items: [
      { label: 'Pro (AI, MCP, BYOK)', path: '/docs/PRO' },
      { label: 'Forge (Enterprise)', path: '/docs/FORGE' },
    ],
  },
  {
    title: 'Blog',
    items: [
      { label: 'Why We Built RevealUI', path: '/docs/blog/01-why-we-built-revealui' },
      { label: 'HTTP 402 Payments', path: '/docs/blog/02-http-402-payments' },
      { label: 'Multi-Agent Coordination', path: '/docs/blog/03-multi-agent-coordination' },
    ],
  },
  {
    title: 'Legal',
    items: [{ label: 'Third-Party Licenses', path: '/docs/THIRD_PARTY_LICENSES' }],
  },
]

function NavLink({ item, depth = 0 }: { item: NavItem; depth?: number }) {
  const location = useLocation()
  const isActive = location.pathname === item.path
  const isParentActive = item.children?.some((child) => location.pathname === child.path)

  return (
    <li>
      <Link
        to={item.path}
        className={isActive ? 'active' : ''}
        style={{
          paddingLeft: `${depth * 12 + 12}px`,
        }}
      >
        {item.label}
      </Link>
      {item.children && (isParentActive || isActive) && (
        <ul>
          {item.children.map((child) => (
            <NavLink key={child.path} item={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}

export function DocLayout({ children }: DocLayoutProps) {
  const location = useLocation()
  const isHome = location.pathname === '/'

  return (
    <div className="docs-container">
      <nav className="docs-sidebar">
        <h2>
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <title>RevealUI</title>
                <path d="M14.25 9.75 16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />
              </svg>
              RevealUI
            </span>
          </Link>
        </h2>
        <div style={{ marginBottom: '1.25rem' }}>
          <SearchBar />
        </div>

        {/* Home link */}
        <ul>
          <li>
            <Link to="/" className={isHome ? 'active' : ''}>
              Home
            </Link>
          </li>
        </ul>

        {/* Sections with labels */}
        {sections.map((section) => (
          <div key={section.title}>
            <div
              style={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--color-text-muted)',
                padding: '1rem 0.75rem 0.375rem',
                marginTop: '0.25rem',
              }}
            >
              {section.title}
            </div>
            <ul>
              {section.items.map((item) => (
                <NavLink key={item.path} item={item} />
              ))}
            </ul>
          </div>
        ))}

        {/* Footer */}
        <div
          style={{
            marginTop: 'auto',
            paddingTop: '1rem',
            borderTop: '1px solid var(--color-border)',
          }}
        >
          <a
            href="https://github.com/RevealUIStudio/revealui"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--color-text-muted)',
              textDecoration: 'none',
              fontSize: '0.8125rem',
              padding: '0.375rem 0.75rem',
              borderRadius: '6px',
            }}
          >
            <svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <title>GitHub</title>
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            GitHub
          </a>
          <a
            href="https://revealui.com"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--color-text-muted)',
              textDecoration: 'none',
              fontSize: '0.8125rem',
              padding: '0.375rem 0.75rem',
              borderRadius: '6px',
              marginTop: '0.25rem',
            }}
          >
            <svg
              height="16"
              width="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <title>Website</title>
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            revealui.com
          </a>
        </div>
      </nav>
      <main className="docs-content">{children}</main>
    </div>
  )
}
