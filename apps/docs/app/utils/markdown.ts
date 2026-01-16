/**
 * Markdown rendering utilities for documentation
 */

import type ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'

export function renderMarkdown(content: string): React.ReactElement {
  return (
    <div className="markdown-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {content}
      </ReactMarkdown>
    </div>
  )
}

/**
 * In-memory cache for loaded markdown files
 * Key: file path, Value: { content: string, timestamp: number }
 */
const markdownCache = new Map<string, { content: string; timestamp: number }>()

/**
 * Cache TTL in milliseconds (5 minutes)
 */
const CACHE_TTL = 5 * 60 * 1000

/**
 * Load markdown file from public directory with caching
 * Files are copied there by the Vite plugin during dev/build
 */
export async function loadMarkdownFile(filePath: string, useCache = true): Promise<string> {
  // Ensure path starts with /
  const normalizedPath = filePath.startsWith('/') ? filePath : `/${filePath}`

  // Check cache first
  if (useCache) {
    const cached = markdownCache.get(normalizedPath)
    if (cached) {
      const age = Date.now() - cached.timestamp
      if (age < CACHE_TTL) {
        return cached.content
      }
      // Cache expired, remove it
      markdownCache.delete(normalizedPath)
    }
  }

  try {
    const response = await fetch(normalizedPath)
    if (!response.ok) {
      throw new Error(`Failed to load markdown file: ${normalizedPath} (${response.status})`)
    }
    
    const content = await response.text()
    
    // Store in cache
    if (useCache) {
      markdownCache.set(normalizedPath, {
        content,
        timestamp: Date.now(),
      })
    }
    
    return content
  } catch (error) {
    // Provide helpful error message with logging
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[markdown-loader] Failed to load: ${normalizedPath}`, errorMessage)
    
    throw new Error(
      `Failed to load markdown file: ${normalizedPath}. ` +
      `Make sure the file exists in docs/ directory and has been copied by the Vite plugin. ` +
      `Error: ${errorMessage}`,
    )
  }
}

/**
 * Clear the markdown cache (useful for testing or manual refresh)
 */
export function clearMarkdownCache(): void {
  markdownCache.clear()
}

/**
 * Clear a specific file from cache
 */
export function clearMarkdownCacheEntry(filePath: string): void {
  const normalizedPath = filePath.startsWith('/') ? filePath : `/${filePath}`
  markdownCache.delete(normalizedPath)
}

/**
 * Get cache statistics (for debugging)
 */
export function getMarkdownCacheStats(): {
  size: number
  entries: Array<{ path: string; age: number }>
} {
  const now = Date.now()
  const entries = Array.from(markdownCache.entries()).map(([path, value]) => ({
    path,
    age: now - value.timestamp,
  }))

  return {
    size: markdownCache.size,
    entries,
  }
}
