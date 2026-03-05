import { logger } from '@revealui/core/observability/logger'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { LicenseGate } from '../components/LicenseGate'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { loadMarkdownFile, renderMarkdown } from '../utils/markdown'
import { sanitizePath } from '../utils/paths'

function ProContent() {
  const { '*': routePath } = useParams()
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDoc() {
      setLoading(true)

      let filePath: string
      if (!routePath || routePath === '') {
        filePath = '/docs-pro/index.md'
      } else {
        const sanitized = sanitizePath(routePath)
        if (!sanitized) {
          filePath = '/docs-pro/index.md'
        } else if (sanitized.endsWith('.md')) {
          filePath = `/docs-pro/${sanitized}`
        } else {
          // Try as directory index first, then as direct file
          filePath = `/docs-pro/${sanitized}/index.md`
        }
      }

      try {
        const loaded = await loadMarkdownFile(filePath, true)
        setContent(loaded)
      } catch {
        // Fallback: try as .md if index.md failed
        const directPath = filePath.endsWith('/index.md')
          ? filePath.replace('/index.md', '.md')
          : filePath

        try {
          const loaded = await loadMarkdownFile(directPath, true)
          setContent(loaded)
        } catch (err) {
          logger.error(
            `[ProPage] Failed to load: ${filePath}`,
            err instanceof Error ? err : new Error(String(err)),
          )
          setContent(`# Not found

Document not found at \`${filePath}\`.

[Back to Pro docs](/pro)
`)
        }
      }

      setLoading(false)
    }

    void loadDoc()
  }, [routePath])

  if (loading) {
    return <LoadingSkeleton />
  }

  return (
    <ErrorBoundary>
      <div>{renderMarkdown(content)}</div>
    </ErrorBoundary>
  )
}

export function ProPage() {
  return (
    <LicenseGate>
      <ProContent />
    </LicenseGate>
  )
}
