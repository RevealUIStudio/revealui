/**
 * RevealUI Rich Text Editor - React Server Components
 * 
 * Provides server-side rendering components for Lexical content.
 */

import type { SerializedEditorState } from 'lexical'

// RSC Entry components for rendering Lexical content on the server
export interface RscEntryLexicalCellProps {
  data?: SerializedEditorState | null
  className?: string
}

export interface RscEntryLexicalFieldProps {
  data?: SerializedEditorState | null
  className?: string
}

/**
 * Server component for rendering Lexical content in table cells
 */
export function RscEntryLexicalCell({ data, className }: RscEntryLexicalCellProps) {
  if (!data) {
    return null
  }
  
  // For now, return a placeholder
  // Full implementation would serialize the Lexical state to HTML
  return (
    <div className={className}>
      <span>[Rich Text Content]</span>
    </div>
  )
}

/**
 * Server component for rendering Lexical content in form fields
 */
export function RscEntryLexicalField({ data, className }: RscEntryLexicalFieldProps) {
  if (!data) {
    return null
  }
  
  // For now, return a placeholder
  // Full implementation would serialize the Lexical state to HTML
  return (
    <div className={className}>
      <span>[Rich Text Content]</span>
    </div>
  )
}

// Re-export serialization utilities
export { $generateHtmlFromNodes } from '@lexical/html'
