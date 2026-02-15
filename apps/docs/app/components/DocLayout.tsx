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
      { label: 'Tutorial', path: '/docs/TUTORIAL' },
      { label: 'Development Guide', path: '/docs/DEVELOPMENT_GUIDE' },
    ],
  },
  {
    label: 'Core Concepts',
    path: '/docs/CMS_GUIDE',
    children: [
      { label: 'CMS Guide', path: '/docs/CMS_GUIDE' },
      { label: 'Authentication', path: '/docs/AUTH' },
      { label: 'Database', path: '/docs/DATABASE' },
      { label: 'Components', path: '/docs/COMPONENT_CATALOG' },
      { label: 'Performance', path: '/docs/PERFORMANCE' },
    ],
  },
  { label: 'API Reference', path: '/api' },
  {
    label: 'Architecture',
    path: '/docs/ARCHITECTURE',
    children: [
      { label: 'Overview', path: '/docs/ARCHITECTURE' },
      { label: 'Database Optimization', path: '/architecture/DATABASE_OPTIMIZATION' },
    ],
  },
  {
    label: 'Deployment',
    path: '/deployment',
    children: [
      { label: 'Deployment Guide', path: '/deployment/DEPLOYMENT' },
      { label: 'CI/CD Guide', path: '/docs/CI_CD_GUIDE' },
      { label: 'Staging', path: '/deployment/STAGING_DEPLOYMENT_GUIDE' },
      { label: 'Environment Variables', path: '/docs/ENVIRONMENT_VARIABLES_GUIDE' },
    ],
  },
  {
    label: 'Testing',
    path: '/testing',
    children: [
      { label: 'Overview', path: '/docs/TESTING' },
      { label: 'Component Testing', path: '/testing/COMPONENT_TESTING' },
      { label: 'Integration Testing', path: '/testing/INTEGRATION_TESTING' },
      { label: 'E2E Testing', path: '/testing/E2E_TESTING' },
    ],
  },
  {
    label: 'Development',
    path: '/development',
    children: [
      { label: 'API Optimization', path: '/development/API_OPTIMIZATION' },
      { label: 'Bundle Optimization', path: '/development/BUNDLE_OPTIMIZATION' },
      { label: 'Caching Strategy', path: '/development/CACHING_STRATEGY' },
    ],
  },
  {
    label: 'Security',
    path: '/docs/SECURITY',
    children: [
      { label: 'Security Policy', path: '/docs/SECURITY' },
      { label: 'Security Audit', path: '/security/SECURITY_AUDIT' },
      { label: 'Secrets Management', path: '/docs/SECRETS-MANAGEMENT' },
    ],
  },
  {
    label: 'AI',
    path: '/ai',
    children: [
      { label: 'Prompt Caching', path: '/ai/PROMPT_CACHING' },
      { label: 'Response Caching', path: '/ai/RESPONSE_CACHING' },
      { label: 'Semantic Caching', path: '/ai/SEMANTIC_CACHING' },
    ],
  },
  {
    label: 'Guides',
    path: '/guides',
    children: [
      { label: 'Documentation Workflow', path: '/guides/DOCUMENTATION_WORKFLOW_GUIDE' },
      { label: 'Migration Guide', path: '/docs/MIGRATION_GUIDE' },
      { label: 'Troubleshooting', path: '/docs/TROUBLESHOOTING' },
      { label: 'Governance', path: '/docs/GOVERNANCE' },
    ],
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
      </nav>
      <main className="docs-content">{children}</main>
    </div>
  )
}
