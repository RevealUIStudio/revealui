'use client'

/**
 * Paste Handling Plugin
 *
 * Registers clipboard event handlers for rich text paste support.
 * Uses @lexical/clipboard for HTML-to-Lexical conversion.
 */

import { $generateNodesFromDOM } from '@lexical/html'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_LOW, PASTE_COMMAND } from 'lexical'
import { useEffect } from 'react'

export function PastePlugin(): null {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (event: ClipboardEvent) => {
        const clipboardData = event.clipboardData
        if (!clipboardData) return false

        const htmlData = clipboardData.getData('text/html')
        if (!htmlData) return false // Let Lexical handle plain text paste

        event.preventDefault()

        editor.update(() => {
          const selection = $getSelection()
          if (!$isRangeSelection(selection)) return

          const parser = new DOMParser()
          const dom = parser.parseFromString(htmlData, 'text/html')
          const nodes = $generateNodesFromDOM(editor, dom)

          selection.insertNodes(nodes)
        })

        return true
      },
      COMMAND_PRIORITY_LOW,
    )
  }, [editor])

  return null
}
