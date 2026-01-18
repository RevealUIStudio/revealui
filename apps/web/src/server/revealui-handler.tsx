import { getRevealUI } from '@revealui/core'
import { logger } from '@revealui/core'
import type { Get, UniversalHandler } from '@universal-middleware/core'
import React from 'react'
import ReactDOMServer from 'react-dom/server'
// Import from relative path to avoid Vite resolution issues with package exports
// TODO: Fix package exports or Vite config to properly resolve @revealui/core/richtext-lexical/rsc
import {
  type SerializedEditorState,
  serializeLexicalState,
} from '../../../../packages/core/src/richtext-lexical/exports/server/rsc'

// Type definitions for page data
interface PageMetadata {
  title?: string
  description?: string
  ogTitle?: string
  ogDescription?: string
}

interface PageData {
  id?: string | number
  title?: string
  content?: string | Record<string, unknown>
  layout?: Array<{
    blockType?: string
    [key: string]: unknown
  }>
  meta?: PageMetadata
  excerpt?: string
  [key: string]: unknown
}

// HTML escaping function to prevent XSS
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// Get RevealUI config - web app can share the same config as CMS or have its own
let revealuiInstance: Awaited<ReturnType<typeof getRevealUI>> | null = null

async function getReveal(): Promise<Awaited<ReturnType<typeof getRevealUI>> | null> {
  if (!revealuiInstance) {
    try {
      // Try to get config from environment or use CMS connection
      const { default: config } = await import('@reveal-config').catch(() => {
        // In production, this fallback should not be used - fail loudly
        if (process.env.NODE_ENV === 'production') {
          throw new Error(
            'RevealUI configuration is required in production. Please configure @reveal-config or create a revealui.config.ts file.',
          )
        }
        // Development fallback for testing
        return {
          default: {
            collections: [],
            globals: [],
            db: null,
            secret: process.env.REVEALUI_SECRET || 'dev-secret',
          },
        }
      })

      revealuiInstance = await getRevealUI({
        config: config,
      })
    } catch (error) {
      // In production, re-throw to fail loudly
      if (process.env.NODE_ENV === 'production') {
        throw error
      }
      // In development, log but continue (for easier debugging)
      logger.error('Failed to initialize RevealUI', { error })
      return null
    }
  }
  return revealuiInstance
}

// Safe React component for page content - NO dangerouslySetInnerHTML
function PageContent({ page }: { page: PageData }) {
  // Safely render title (React auto-escapes text content)
  const safeTitle = page.title ? String(page.title) : null

  // Handle content - if it's a string, escape it; if it's rich text (object), render safely
  let contentElement: React.ReactNode = null
  if (page.content) {
    if (typeof page.content === 'string') {
      // Plain text content - React will auto-escape
      contentElement = <div>{page.content}</div>
    } else if (typeof page.content === 'object' && page.content !== null) {
      // Rich text content (Lexical JSON) - serialize to React elements
      // Type guard: verify the content structure matches SerializedEditorState
      const contentAsLexical = page.content
      if (contentAsLexical.root && typeof contentAsLexical.root === 'object') {
        // Type assertion is safe here because we've validated the structure matches SerializedEditorState
        const lexicalContent = serializeLexicalState(
          contentAsLexical as unknown as SerializedEditorState,
        )
        if (lexicalContent) {
          contentElement = <div className="rich-text-content">{lexicalContent}</div>
        } else {
          // Fallback if serialization fails
          contentElement = <div className="rich-text-content">Content unavailable</div>
        }
      } else {
        // Content doesn't match Lexical structure
        contentElement = <div className="rich-text-content">Content unavailable</div>
      }
    }
  }

  // Safely render layout blocks
  const layoutElements =
    page.layout && Array.isArray(page.layout) ? (
      <div className="blocks">
        {page.layout.map((block, index) => {
          const blockType = block?.blockType ? String(block.blockType) : 'unknown'
          // Use block.id if available, otherwise use blockType-index for stable key
          const blockKey = (block as { id?: string | null })?.id ?? `${blockType}-${index}`
          return (
            <div key={blockKey} className={`block block-${blockType}`}>
              {/* Render block content safely - no HTML injection */}
              <div className="block-content">
                {blockType && <h3 className="block-type">{blockType}</h3>}
                {/* For now, render as JSON - in production, use proper block renderers */}
                <pre className="block-data">{JSON.stringify(block, null, 2)}</pre>
              </div>
            </div>
          )
        })}
      </div>
    ) : null

  return (
    <div className="page-content">
      {safeTitle && <h1>{safeTitle}</h1>}
      {contentElement}
      {layoutElements}
    </div>
  )
}

// Safe HTML template with proper escaping
function renderHTML(content: string, title: string = 'RevealUI Web', meta?: PageMetadata) {
  const safeTitle = escapeHtml(meta?.title || title)
  const safeDescription = meta?.description ? escapeHtml(meta.description) : ''
  const safeOgTitle = meta?.ogTitle ? escapeHtml(meta.ogTitle) : ''
  const safeOgDescription = meta?.ogDescription ? escapeHtml(meta.ogDescription) : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  ${safeDescription ? `<meta name="description" content="${safeDescription}">` : ''}
  ${safeOgTitle ? `<meta property="og:title" content="${safeOgTitle}">` : ''}
  ${safeOgDescription ? `<meta property="og:description" content="${safeOgDescription}">` : ''}
</head>
<body>
  ${content}
</body>
</html>`
}

/**
 * RevealUI SSR Handler
 * Handles server-side rendering of CMS content for the web app
 */
export const revealuiHandler: Get<[], UniversalHandler> = () => async (request) => {
  const url = new URL(request.url)
  const pathname = url.pathname

  // Skip API routes
  if (pathname.startsWith('/api/')) {
    return new Response('Not Found', { status: 404 })
  }

  try {
    const revealui = await getReveal()

    if (!revealui) {
      // If RevealUI isn't initialized, return a helpful error page
      // In production, this should not happen (getReveal throws)
      return new Response(
        renderHTML(
          '<h1>RevealUI CMS Not Available</h1><p>The CMS backend is not configured. Please check your configuration.</p>',
          'CMS Error',
        ),
        {
          status: 503,
          headers: {
            'Content-Type': 'text/html',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        },
      )
    }

    // Extract slug from pathname (remove leading/trailing slashes)
    const slug = pathname.replace(/^\/|\/$/g, '') || 'home'

    // Query page by slug
    const result = await revealui.find({
      collection: 'pages',
      where: {
        slug: {
          equals: slug,
        },
      },
      limit: 1,
      depth: 1, // Populate relationships
      overrideAccess: true, // Public pages don't need auth
    })

    const page = result.docs?.[0] as PageData | undefined

    if (!page) {
      // Page not found - return 404
      return new Response(
        renderHTML(
          '<h1>Page Not Found</h1><p>The requested page could not be found.</p>',
          '404 - Page Not Found',
        ),
        {
          status: 404,
          headers: {
            'Content-Type': 'text/html',
            'Cache-Control': 'public, max-age=3600', // Cache 404s for 1 hour
          },
        },
      )
    }

    // Render React component to HTML string (React auto-escapes content)
    const pageContent = React.createElement(PageContent, { page })
    const htmlContent = ReactDOMServer.renderToString(pageContent)

    // Extract metadata from page with proper type safety
    const meta: PageMetadata = {
      title: (page.title ? String(page.title) : page.meta?.title) || 'RevealUI Web',
      description: page.meta?.description || (page.excerpt ? String(page.excerpt) : undefined),
      ogTitle: page.meta?.ogTitle || (page.title ? String(page.title) : undefined),
      ogDescription:
        page.meta?.ogDescription ||
        page.meta?.description ||
        (page.excerpt ? String(page.excerpt) : undefined),
    }

    // Return rendered HTML
    return new Response(renderHTML(htmlContent, meta.title || 'RevealUI Web', meta), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300', // Cache pages for 5 minutes
      },
    })
  } catch (error) {
    // Structured error logging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined

    // Log error with appropriate detail level
    logger.error('RevealUI Handler Error', {
      errorMessage,
      errorStack: process.env.NODE_ENV === 'production' ? undefined : errorStack,
      error,
    })

    // Return generic error page (don't expose internal errors)
    return new Response(
      renderHTML(
        '<h1>Server Error</h1><p>An error occurred while processing your request. Please try again later.</p>',
        'Server Error',
      ),
      {
        status: 500,
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      },
    )
  }
}
