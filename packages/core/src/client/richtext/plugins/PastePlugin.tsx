'use client';

/**
 * Paste Handling Plugin
 *
 * Registers clipboard event handlers for rich text paste support.
 * Uses @lexical/clipboard for HTML-to-Lexical conversion.
 */

import { $generateNodesFromDOM } from '@lexical/html';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_LOW, PASTE_COMMAND } from 'lexical';
import { useEffect } from 'react';

/**
 * Sanitize a parsed DOM document by removing dangerous elements and attributes.
 * This prevents XSS from pasted HTML content.
 */
function sanitizeDom(doc: Document): void {
  // Remove script, style, iframe, object, embed, form, and event-handler elements
  const dangerous = doc.querySelectorAll(
    'script, style, iframe, object, embed, form, link[rel="import"], base',
  );
  for (const el of dangerous) {
    el.remove();
  }

  // Remove dangerous attributes from all remaining elements
  const allElements = doc.querySelectorAll('*');
  for (const el of allElements) {
    const attrs = [...el.attributes];
    for (const attr of attrs) {
      const name = attr.name.toLowerCase();
      // Remove event handlers (onclick, onerror, etc.) and javascript: URLs
      if (name.startsWith('on') || attr.value.trim().toLowerCase().startsWith('javascript:')) {
        el.removeAttribute(attr.name);
      }
    }
  }
}

export function PastePlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (event: ClipboardEvent) => {
        const clipboardData = event.clipboardData;
        if (!clipboardData) return false;

        const htmlData = clipboardData.getData('text/html');
        if (!htmlData) return false; // Let Lexical handle plain text paste

        event.preventDefault();

        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;

          const parser = new DOMParser();
          const dom = parser.parseFromString(htmlData, 'text/html');
          sanitizeDom(dom);
          const nodes = $generateNodesFromDOM(editor, dom);

          selection.insertNodes(nodes);
        });

        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);

  return null;
}
