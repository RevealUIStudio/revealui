import { logger } from '@revealui/core/observability/logger'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { loadMarkdownFile, renderMarkdown } from '../utils/markdown'
import type { DocSection } from '../utils/paths'
import { resolveDocPath } from '../utils/paths'

interface SectionPageProps {
  section: DocSection
  title: string
  fallbackIndex?: string
}

function SectionContent({ section, title }: SectionPageProps) {
  const { '*': path } = useParams()
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadDoc() {
      try {
        setLoading(true)
        setError(null)

        const resolved = resolveDocPath({
          section,
          routePath: path || null,
        })

        try {
          const loaded = await loadMarkdownFile(resolved.markdownPath, true)
          setContent(loaded)
        } catch (loadError) {
          logger.error(
            `[${title}] Failed to load: ${resolved.markdownPath}`,
            loadError instanceof Error ? loadError : new Error(String(loadError)),
          )

          setContent(`# ${title}: ${resolved.displayPath || 'Index'}

Document not found at \`${resolved.markdownPath}\`.

[Back to ${title}](/${section})
`)
        }

        setLoading(false)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : `Failed to load ${title}`
        setError(errorMessage)
        logger.error(`[${title}] Error`, err instanceof Error ? err : new Error(String(err)))
        setLoading(false)
      }
    }

    void loadDoc()
  }, [path, section, title])

  if (loading) {
    return <LoadingSkeleton />
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
        <h1>Error Loading {title}</h1>
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

function SectionIndex({ section, title, fallbackIndex }: SectionPageProps) {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadIndex() {
      try {
        const resolved = resolveDocPath({
          section,
          routePath: null,
        })

        const indexContent = await loadMarkdownFile(resolved.markdownPath, true)
        setContent(indexContent)
      } catch (error) {
        logger.error(
          `[${title}] Failed to load index`,
          error instanceof Error ? error : new Error(String(error)),
        )

        setContent(
          fallbackIndex ||
            `# ${title}

Content is being organized. Check back soon!
`,
        )
      } finally {
        setLoading(false)
      }
    }

    void loadIndex()
  }, [section, title, fallbackIndex])

  if (loading) {
    return <LoadingSkeleton />
  }

  return (
    <ErrorBoundary>
      <div>{renderMarkdown(content)}</div>
    </ErrorBoundary>
  )
}

export function SectionPage(props: SectionPageProps) {
  const { '*': path } = useParams()

  if (!path || path === '') {
    return <SectionIndex {...props} />
  }

  return <SectionContent {...props} />
}
