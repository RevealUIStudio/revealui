/**
 * Client-side search component for documentation
 */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface SearchResult {
  path: string
  title: string
  section: 'guides' | 'api' | 'reference'
  excerpt?: string
}

/**
 * Simple client-side search implementation
 * Searches through loaded markdown content
 */
export function SearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()

  // Search through loaded content (simplified - in production, use a search index)
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }

    // For now, provide suggestions based on common paths
    // In a full implementation, this would search through actual markdown content
    const commonResults: SearchResult[] = []
    const lowerQuery = query.toLowerCase()

    const suggestions = [
      { path: '/guides/getting-started', title: 'Getting Started', section: 'guides' as const },
      { path: '/guides/installation', title: 'Installation', section: 'guides' as const },
      { path: '/guides/configuration', title: 'Configuration', section: 'guides' as const },
      { path: '/api/revealui-core', title: 'RevealUI Core API', section: 'api' as const },
      { path: '/api/revealui-schema', title: 'Schema API', section: 'api' as const },
      {
        path: '/reference/config',
        title: 'Configuration Reference',
        section: 'reference' as const,
      },
    ]

    for (const suggestion of suggestions) {
      if (
        suggestion.title.toLowerCase().includes(lowerQuery) ||
        suggestion.path.toLowerCase().includes(lowerQuery)
      ) {
        commonResults.push(suggestion)
      }
    }

    setResults(commonResults.slice(0, 5)) // Limit to 5 results
  }, [query])

  const handleSelect = (result: SearchResult) => {
    navigate(result.path)
    setQuery('')
    setIsOpen(false)
  }

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
      <div style={{ position: 'relative' }}>
        <input
          type="search"
          placeholder="Search documentation..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            // Delay closing to allow click on results
            setTimeout(() => setIsOpen(false), 200)
          }}
          style={{
            width: '100%',
            padding: '0.5rem 2.5rem 0.5rem 0.75rem',
            border: '1px solid #e1e4e8',
            borderRadius: '6px',
            fontSize: '0.875rem',
          }}
        />
        <span
          style={{
            position: 'absolute',
            right: '0.75rem',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#6a737d',
          }}
        >
          ⌘K
        </span>
      </div>

      {isOpen && results.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '0.25rem',
            background: 'white',
            border: '1px solid #e1e4e8',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 1000,
            maxHeight: '400px',
            overflowY: 'auto',
          }}
        >
          {results.map((result, index) => (
            <button
              key={index}
              onClick={() => handleSelect(result)}
              style={{
                width: '100%',
                padding: '0.75rem',
                textAlign: 'left',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                borderBottom: index < results.length - 1 ? '1px solid #e1e4e8' : 'none',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f6f8fa'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <div style={{ fontWeight: 500, color: '#24292f', marginBottom: '0.25rem' }}>
                {result.title}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6a737d', textTransform: 'capitalize' }}>
                {result.section}
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && query && results.length === 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '0.25rem',
            background: 'white',
            border: '1px solid #e1e4e8',
            borderRadius: '6px',
            padding: '1rem',
            textAlign: 'center',
            color: '#6a737d',
            fontSize: '0.875rem',
          }}
        >
          No results found
        </div>
      )}
    </div>
  )
}
