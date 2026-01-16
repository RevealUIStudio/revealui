import { renderMarkdown, loadMarkdownFile } from '../utils/markdown'
import { resolveDocPath } from '../utils/paths'
import { useState, useEffect } from 'react'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { LoadingSkeleton } from '../components/LoadingSkeleton'

export function ReferencePage() {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadReference() {
      try {
        // Use shared path resolution utility for index
        const resolved = resolveDocPath({
          section: 'reference',
          routePath: undefined,
        })

        const indexContent = await loadMarkdownFile(resolved.markdownPath, true) // Use cache
        setContent(indexContent)
      } catch (error) {
        // Log error for debugging
        console.error('[ReferencePage] Failed to load reference index:', error)

        // Fallback content
        setContent(`# Reference Documentation

Technical reference documentation for RevealUI Framework.

## Sections

- Configuration Reference
- Type Definitions
- Schema Reference
- Technical Specifications

## Coming Soon

Reference documentation is being organized. Check back soon!

For now, see the [API Reference](/api) for complete API documentation.
`)
      } finally {
        setLoading(false)
      }
    }

    loadReference()
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
