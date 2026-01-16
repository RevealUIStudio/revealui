import { Link, Outlet } from 'react-router-dom'
import { SearchBar } from './SearchBar'

interface DocLayoutProps {
  children?: React.ReactNode
}

export function DocLayout({ children }: DocLayoutProps) {
  return (
    <div className="docs-container">
      <nav className="docs-sidebar">
        <h2>Documentation</h2>
        <div style={{ marginBottom: '1rem' }}>
          <SearchBar />
        </div>
        <ul>
          <li>
            <Link to="/">Home</Link>
          </li>
          <li>
            <Link to="/guides">Guides</Link>
          </li>
          <li>
            <Link to="/api">API Reference</Link>
          </li>
          <li>
            <Link to="/reference">Reference</Link>
          </li>
        </ul>
      </nav>
      <main className="docs-content">
        {children || <Outlet />}
      </main>
    </div>
  )
}
