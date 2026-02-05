import { useEffect, useState } from 'react'
import { logger } from '@revealui/core/observability/logger'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { loadMarkdownFile, renderMarkdown } from '../utils/markdown'
import { resolveDocPath } from '../utils/paths'

export function ReferencePage() {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadReference() {
      try {
        // Use shared path resolution utility for index
        const resolved = resolveDocPath({
          section: 'reference',
          routePath: null,
        })

        const indexContent = await loadMarkdownFile(resolved.markdownPath, true) // Use cache
        setContent(indexContent)
      } catch (error) {
        // Log error for debugging
        logger.error('[ReferencePage] Failed to load reference index', error instanceof Error ? error : new Error(String(error)))

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

    void loadReference()
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
