import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'

type Anchor =
  | 'top'
  | 'top start'
  | 'top end'
  | 'bottom'
  | 'bottom start'
  | 'bottom end'
  | 'selection start'

interface UsePopoverOptions {
  /** Whether the popover is open */
  open: boolean
  /** Preferred anchor position */
  anchor?: Anchor
  /** Gap between trigger and popover (px) */
  gap?: number
  /** Padding from viewport edges (px) */
  padding?: number
}

interface PopoverPosition {
  top: number
  left: number
  maxHeight: number
}

interface UsePopoverReturn {
  triggerRef: RefObject<HTMLElement | null>
  popoverRef: RefObject<HTMLElement | null>
  position: PopoverPosition
  popoverProps: {
    style: React.CSSProperties
  }
}

function computePosition(
  trigger: HTMLElement,
  popover: HTMLElement,
  anchor: Anchor,
  gap: number,
  padding: number,
): PopoverPosition {
  const triggerRect = trigger.getBoundingClientRect()
  const popoverRect = popover.getBoundingClientRect()
  const viewportHeight = window.innerHeight
  const viewportWidth = window.innerWidth

  let top: number
  let left: number
  let maxHeight: number

  // Vertical positioning
  const isTop = anchor.startsWith('top')
  const spaceBelow = viewportHeight - triggerRect.bottom - gap - padding
  const spaceAbove = triggerRect.top - gap - padding

  if (anchor === 'selection start') {
    // Position at the selection start (aligned with trigger)
    top = triggerRect.top
    maxHeight = viewportHeight - top - padding
  } else if (isTop) {
    top = triggerRect.top - popoverRect.height - gap
    maxHeight = spaceAbove
    // Flip to bottom if not enough space
    if (top < padding && spaceBelow > spaceAbove) {
      top = triggerRect.bottom + gap
      maxHeight = spaceBelow
    }
  } else {
    top = triggerRect.bottom + gap
    maxHeight = spaceBelow
    // Flip to top if not enough space
    if (top + popoverRect.height > viewportHeight - padding && spaceAbove > spaceBelow) {
      top = triggerRect.top - popoverRect.height - gap
      maxHeight = spaceAbove
    }
  }

  // Horizontal positioning
  const isEnd = anchor.endsWith('end')
  const isStart = anchor.endsWith('start')

  if (isEnd) {
    left = triggerRect.right - popoverRect.width
  } else if (isStart || anchor === 'selection start') {
    left = triggerRect.left
  } else {
    // Center
    left = triggerRect.left + (triggerRect.width - popoverRect.width) / 2
  }

  // Clamp to viewport
  left = Math.max(padding, Math.min(left, viewportWidth - popoverRect.width - padding))
  top = Math.max(padding, top)

  return { top, left, maxHeight: Math.max(100, maxHeight) }
}

export function usePopover({
  open,
  anchor = 'bottom',
  gap = 8,
  padding = 4,
}: UsePopoverOptions): UsePopoverReturn {
  const triggerRef = useRef<HTMLElement | null>(null)
  const popoverRef = useRef<HTMLElement | null>(null)
  const [position, setPosition] = useState<PopoverPosition>({
    top: 0,
    left: 0,
    maxHeight: 300,
  })

  const updatePosition = useCallback(() => {
    if (!(triggerRef.current && popoverRef.current && open)) return
    const pos = computePosition(triggerRef.current, popoverRef.current, anchor, gap, padding)
    setPosition(pos)
  }, [open, anchor, gap, padding])

  // Update position when open changes or on scroll/resize
  useEffect(() => {
    if (!open) return

    // Initial positioning (after popover renders)
    requestAnimationFrame(updatePosition)

    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)

    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open, updatePosition])

  return {
    triggerRef,
    popoverRef,
    position,
    popoverProps: {
      style: {
        position: 'fixed',
        top: position.top,
        left: position.left,
        maxHeight: position.maxHeight,
        zIndex: 50,
      },
    },
  }
}
