/**
 * Client-side search bar for documentation.
 *
 * Uses FlexSearch to provide instant full-text search across all docs.
 * Supports Cmd+K / Ctrl+K keyboard shortcut to focus.
 */

import { useNavigate } from '@revealui/router';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SearchResult } from '../lib/search-index';
import { buildSearchIndex, searchDocs } from '../lib/search-index';

export function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [indexReady, setIndexReady] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const navigate = useNavigate();

  // Build search index on mount (lazy, once)
  useEffect(() => {
    void buildSearchIndex().then(() => {
      setIndexReady(true);
    });
  }, []);

  // Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    }
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Debounced search
  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      setActiveIndex(-1);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (!value.trim()) {
        setResults([]);
        return;
      }

      debounceRef.current = setTimeout(() => {
        if (indexReady) {
          setResults(searchDocs(value));
        }
      }, 200);
    },
    [indexReady],
  );

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      void navigate(`/${result.path}`);
      setQuery('');
      setResults([]);
      setIsOpen(false);
      setActiveIndex(-1);
    },
    [navigate],
  );

  // Keyboard navigation within results
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || results.length === 0) {
        if (e.key === 'Escape') {
          setIsOpen(false);
          inputRef.current?.blur();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
          break;
        }
        case 'Enter': {
          e.preventDefault();
          const selected = results[activeIndex];
          if (activeIndex >= 0 && selected) {
            handleSelect(selected);
          }
          break;
        }
        case 'Escape': {
          setIsOpen(false);
          inputRef.current?.blur();
          break;
        }
      }
    },
    [isOpen, results, activeIndex, handleSelect],
  );

  return (
    <div className="relative w-full">
      <div className="relative">
        <input
          ref={inputRef}
          type="search"
          placeholder="Search docs..."
          value={query}
          onChange={(e) => {
            handleQueryChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            setTimeout(() => setIsOpen(false), 200);
          }}
          onKeyDown={handleKeyDown}
          className="w-full rounded-lg border border-border bg-surface py-2 pr-10 pl-3 font-sans text-[0.8125rem] text-text-primary transition-all focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-bg)] focus:outline-none"
        />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-text-muted">
          {'\u2318'}K
        </span>
      </div>

      {isOpen && results.length > 0 && (
        <div
          role="listbox"
          className="absolute top-full right-0 left-0 z-[1000] mt-1 max-h-[60vh] overflow-y-auto rounded-lg border border-border bg-surface shadow-lg"
        >
          {results.map((result, i) => (
            <button
              type="button"
              role="option"
              aria-selected={i === activeIndex}
              key={result.path}
              onClick={() => handleSelect(result)}
              onMouseEnter={() => setActiveIndex(i)}
              className={`w-full cursor-pointer border-none px-3 py-2.5 text-left font-sans transition-colors ${
                i === activeIndex ? 'bg-accent-bg' : 'bg-transparent hover:bg-accent-bg'
              } ${i < results.length - 1 ? 'border-b border-border-subtle' : ''}`}
            >
              <div className="mb-0.5 font-medium text-text-primary">{result.title}</div>
              {result.excerpt && (
                <div className="truncate text-xs leading-snug text-text-muted">
                  {result.excerpt}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {isOpen && query && results.length === 0 && (
        <div className="absolute top-full right-0 left-0 mt-1 rounded-lg border border-border bg-surface p-4 text-center text-sm text-text-muted">
          {indexReady ? (
            <div>
              <p className="font-medium text-text-secondary">No results found</p>
              <p className="mt-1 text-xs">
                Try different keywords or browse the sidebar navigation
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <svg
                className="size-4 animate-spin text-accent"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="2"
                  opacity="0.25"
                />
                <path
                  d="M4 12a8 8 0 018-8"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <span>Building search index...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
