import { useCallback, useRef } from 'react'

interface UseTypeAheadOptions {
  /** Function to get the text content of an item by index */
  getItemText: (index: number) => string
  /** Total number of items */
  itemCount: number
  /** Callback when a match is found */
  onMatch: (index: number) => void
  /** Timeout before search buffer resets (ms) */
  timeout?: number
}

export function useTypeAhead({
  getItemText,
  itemCount,
  onMatch,
  timeout = 350,
}: UseTypeAheadOptions): {
  onKeyDown: (e: React.KeyboardEvent) => void
} {
  const searchBuffer = useRef('')
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Only handle single character keys (not special keys)
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return

      // Clear previous timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // Append to search buffer
      searchBuffer.current += e.key.toLowerCase()

      // Set timeout to clear buffer
      timeoutRef.current = setTimeout(() => {
        searchBuffer.current = ''
      }, timeout)

      // Search for matching item
      const query = searchBuffer.current
      for (let i = 0; i < itemCount; i++) {
        const text = getItemText(i).toLowerCase()
        if (text.startsWith(query)) {
          onMatch(i)
          return
        }
      }
    },
    [getItemText, itemCount, onMatch, timeout],
  )

  return { onKeyDown }
}
