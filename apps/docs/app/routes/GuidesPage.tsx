import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { loadMarkdownFile, renderMarkdown } from '../utils/markdown'
import { resolveDocPath } from '../utils/paths'

function GuideContent() {
  const { '*': path } = useParams()
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadGuide() {
      try {
        setLoading(true)
        setError(null)

        // Use shared path resolution utility
        const resolved = resolveDocPath({
          section: 'guides',
          routePath: path || null,
        })

        try {
          const loaded = await loadMarkdownFile(resolved.markdownPath, true) // Use cache
          setContent(loaded)
        } catch (loadError) {
          // Log error for debugging
          console.error(`[GuidesPage] Failed to load guide: ${resolved.markdownPath}`, loadError)

          // Fallback to placeholder
          setContent(`# Guide: ${resolved.displayPath || 'Index'}

Guide not found at \`${resolved.markdownPath}\`.

Available guides are loaded from the \`docs/guides/\` directory.
`)
        }

        setLoading(false)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load guide'
        setError(errorMessage)
        console.error('[GuidesPage] Error loading guide:', err)
        setLoading(false)
      }
    }

    loadGuide()
  }, [path])

  if (loading) {
    return <LoadingSkeleton />
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
        <h1>Error Loading Guide</h1>
        <p>{error}</p>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div>{renderMarkdown(content)}</div>
    </ErrorBoundary>
  )
}

function GuideIndex() {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadIndex() {
      try {
        // Use shared path resolution utility for index
        const resolved = resolveDocPath({
          section: 'guides',
          routePath: null,
        })

        const indexContent = await loadMarkdownFile(resolved.markdownPath, true) // Use cache
        setContent(indexContent)
      } catch (error) {
        // Log error for debugging
        console.error('[GuidesPage] Failed to load guides index:', error)

        // Fallback
        setContent(`# Guides

Welcome to the RevealUI Framework guides section.

Guides are located in the \`docs/guides/\` directory. Available guides will be listed here once files are copied to the public directory.
`)
      } finally {
        setLoading(false)
      }
    }

    loadIndex()
  }, [])

  if (loading) {
    return <LoadingSkeleton />
  }

  return (
    <ErrorBoundary>
      <div>{renderMarkdown(content)}</div>
    </ErrorBoundary>
  )
}

export function GuidesPage() {
  const { '*': path } = useParams()

  // If no path, show index
  if (!path || path === '') {
    return <GuideIndex />
  }

  return <GuideContent />
}
