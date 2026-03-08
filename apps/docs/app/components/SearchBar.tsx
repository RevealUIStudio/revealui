/**
 * Client-side search bar for documentation.
 *
 * Uses FlexSearch to provide instant full-text search across all docs.
 * Supports Cmd+K / Ctrl+K keyboard shortcut to focus.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { SearchResult } from '../lib/search-index'
import { buildSearchIndex, searchDocs } from '../lib/search-index'

export function SearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [indexReady, setIndexReady] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
  const navigate = useNavigate()

  // Build search index on mount (lazy, once)
  useEffect(() => {
    void buildSearchIndex().then(() => {
      setIndexReady(true)
    })
  }, [])

  // Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setIsOpen(true)
      }
    }
    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  // Debounced search
  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value)
      setActiveIndex(-1)

      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      if (!value.trim()) {
        setResults([])
        return
      }

      debounceRef.current = setTimeout(() => {
        if (indexReady) {
          setResults(searchDocs(value))
        }
      }, 200)
    },
    [indexReady],
  )

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const handleSelect = useCallback(
    (result: SearchResult) => {
      void navigate(`/docs/${result.path}`)
      setQuery('')
      setResults([])
      setIsOpen(false)
      setActiveIndex(-1)
    },
    [navigate],
  )

  // Keyboard navigation within results
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || results.length === 0) {
        if (e.key === 'Escape') {
          setIsOpen(false)
          inputRef.current?.blur()
        }
        return
      }

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault()
          setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0))
          break
        }
        case 'ArrowUp': {
          e.preventDefault()
          setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1))
          break
        }
        case 'Enter': {
          e.preventDefault()
          const selected = results[activeIndex]
          if (activeIndex >= 0 && selected) {
            handleSelect(selected)
          }
          break
        }
        case 'Escape': {
          setIsOpen(false)
          inputRef.current?.blur()
          break
        }
      }
    },
    [isOpen, results, activeIndex, handleSelect],
  )

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type="search"
          placeholder="Search documentation..."
          value={query}
          onChange={(e) => {
            handleQueryChange(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            // Delay closing to allow click on results
            setTimeout(() => setIsOpen(false), 200)
          }}
          onKeyDown={handleKeyDown}
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
            fontSize: '0.75rem',
            pointerEvents: 'none',
          }}
        >
          {'\u2318'}K
        </span>
      </div>

      {isOpen && results.length > 0 && (
        <div
          role="listbox"
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
          {results.map((result, i) => (
            <button
              type="button"
              role="option"
              aria-selected={i === activeIndex}
              key={result.path}
              onClick={() => handleSelect(result)}
              style={{
                width: '100%',
                padding: '0.75rem',
                textAlign: 'left',
                border: 'none',
                background: i === activeIndex ? '#f6f8fa' : 'transparent',
                cursor: 'pointer',
                borderBottom: i < results.length - 1 ? '1px solid #e1e4e8' : 'none',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f6f8fa'
                setActiveIndex(i)
              }}
              onMouseLeave={(e) => {
                if (i !== activeIndex) {
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              <div
                style={{
                  fontWeight: 500,
                  color: '#24292f',
                  marginBottom: '0.25rem',
                }}
              >
                {result.title}
              </div>
              {result.excerpt && (
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#6a737d',
                    lineHeight: 1.4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {result.excerpt}
                </div>
              )}
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
          {indexReady ? 'No results found' : 'Loading search index...'}
        </div>
      )}
    </div>
  )
}
