import React, { useContext } from 'react'
import { PageContext } from '../types'

// Create a context for page context (in a real implementation, this would be populated by the framework)
const PageContextContext = React.createContext<PageContext | null>(null)

export function usePageContext(): PageContext {
  const context = useContext(PageContextContext)

  if (!context) {
    // Return a basic context if none is provided
    return {
      url: window.location.pathname,
      routeParams: {}
    }
  }

  return context
}
