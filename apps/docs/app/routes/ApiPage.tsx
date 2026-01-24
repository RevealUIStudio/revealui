import { useEffect, useState } from 'react'
import { Route, Routes, useParams } from 'react-router-dom'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { loadMarkdownFile, renderMarkdown } from '../utils/markdown'
import { resolveDocPath } from '../utils/paths'

function ApiPackageContent() {
  const { '*': path } = useParams()
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadApiDoc() {
      try {
        setLoading(true)
        setError(null)

        // Use shared path resolution utility
        const resolved = resolveDocPath({
          section: 'api',
          routePath: path || null,
        })

        try {
          const loaded = await loadMarkdownFile(resolved.markdownPath, true) // Use cache
          setContent(loaded)
        } catch (loadError) {
          // Log error for debugging
          console.error(`[ApiPage] Failed to load API docs: ${resolved.markdownPath}`, loadError)

          // Fallback to helpful message
          setContent(`# API Documentation: ${resolved.displayPath || 'Index'}

API documentation not found at \`${resolved.markdownPath}\`.

To generate API documentation, run:

\`\`\`bash
pnpm docs:generate:api
\`\`\`

This will create markdown files in \`docs/api/\` that are automatically copied to the public directory and loaded here.
`)
        }

        setLoading(false)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load API docs'
        setError(errorMessage)
        console.error('[ApiPage] Error loading API docs:', err)
        setLoading(false)
      }
    }

    loadApiDoc()
  }, [path])

  if (loading) {
    return <LoadingSkeleton />
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
        <h1>Error Loading API Documentation</h1>
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

function ApiIndex() {
  const content = `# API Reference

Complete API documentation for RevealUI Framework packages.

## Packages

- [@revealui/core](./revealui-core) - Core CMS framework
- [@revealui/contracts](./revealui-contracts) - Contract definitions and schemas  
- [@revealui/db](./revealui-db) - Database package

## Generation

API documentation is automatically generated from TypeScript source files using JSDoc comments.

To regenerate:

\`\`\`bash
pnpm docs:generate:api
\`\`\`

## Note

**Files in this directory are auto-generated. Do not edit them manually.**

Changes should be made to:
1. Source code JSDoc comments
2. TypeScript type definitions
3. The documentation generator scripts
`

  return (
    <ErrorBoundary>
      <div>{renderMarkdown(content)}</div>
    </ErrorBoundary>
  )
}

export function ApiPage() {
  return (
    <Routes>
      <Route path="/" element={<ApiIndex />} />
      <Route path="*" element={<ApiPackageContent />} />
    </Routes>
  )
}
