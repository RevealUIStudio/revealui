'use client'

/**
 * Layout Animation Hook (FLIP Technique)
 *
 * Replaces motion/react's LayoutGroup + motion.span + layoutId pattern
 * with a native implementation using Web Animations API.
 *
 * The FLIP (First, Last, Invert, Play) technique:
 * 1. Record the element's position before it unmounts (First)
 * 2. Mount the new element and record its position (Last)
 * 3. Calculate the delta between positions (Invert)
 * 4. Animate from old position to new position (Play)
 *
 * @example
 * ```tsx
 * function NavSection({ children }) {
 *   return <LayoutGroup>{children}</LayoutGroup>
 * }
 *
 * function NavItem({ current }) {
 *   return (
 *     <span>
 *       {current && <LayoutIndicator layoutId="indicator" className="..." />}
 *       ...
 *     </span>
 *   )
 * }
 * ```
 */

import { createContext, type ReactNode, type RefObject, use, useLayoutEffect, useRef } from 'react'

// ============================================
// CONTEXT
// ============================================

const LayoutGroupContext = createContext<RefObject<Map<string, DOMRect>> | null>(null)

// ============================================
// LAYOUT GROUP
// ============================================

interface LayoutGroupProps {
  /** Unique identifier for scoping (optional, context-scoped by default) */
  id?: string
  children: ReactNode
}

/**
 * Scopes layout animations to a group.
 * Elements with the same `layoutId` within a group share position data.
 */
export function LayoutGroup({ children }: LayoutGroupProps): ReactNode {
  const rectsRef = useRef(new Map<string, DOMRect>())
  return <LayoutGroupContext value={rectsRef}>{children}</LayoutGroupContext>
}

// ============================================
// HOOK
// ============================================

/** Spring-like easing approximation (matches motion's default layout spring) */
const LAYOUT_EASING = 'cubic-bezier(0.25, 0.8, 0.25, 1)'
const LAYOUT_DURATION = 350

/**
 * Hook that implements FLIP layout animation for an element.
 *
 * When an element with the same `layoutId` unmounts from one position
 * and mounts in another, this hook animates the transition smoothly.
 *
 * @param layoutId - Shared identifier linking old and new positions
 * @returns Ref to attach to the animated element
 */
export function useLayoutAnimation(layoutId: string): RefObject<HTMLElement | null> {
  const ref = useRef<HTMLElement | null>(null)
  const rectsCtx = use(LayoutGroupContext)

  useLayoutEffect(() => {
    const el = ref.current
    const rects = rectsCtx?.current
    if (!(el && rects)) return

    const prevRect = rects.get(layoutId)
    const currentRect = el.getBoundingClientRect()

    // Save current position for next animation
    rects.set(layoutId, currentRect)

    // If we have a previous position, animate from old to new
    if (prevRect) {
      const deltaX = prevRect.left - currentRect.left
      const deltaY = prevRect.top - currentRect.top

      // Only animate if there's actual movement
      if (Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5) {
        el.animate(
          [{ transform: `translate(${deltaX}px, ${deltaY}px)` }, { transform: 'translate(0, 0)' }],
          {
            duration: LAYOUT_DURATION,
            easing: LAYOUT_EASING,
            fill: 'none',
          },
        )
      }
    }

    return () => {
      // Save position before unmount so the next element can animate from here
      if (el) {
        rects.set(layoutId, el.getBoundingClientRect())
      }
    }
  })

  return ref
}

// ============================================
// COMPONENT
// ============================================

interface LayoutIndicatorProps extends React.ComponentPropsWithoutRef<'span'> {
  /** Shared identifier for FLIP animation */
  layoutId: string
}

/**
 * Animated indicator span that smoothly transitions between positions.
 * Drop-in replacement for `<motion.span layoutId="...">`.
 */
export function LayoutIndicator({ layoutId, ...props }: LayoutIndicatorProps): ReactNode {
  const ref = useLayoutAnimation(layoutId)
  return <span ref={ref as RefObject<HTMLSpanElement>} {...props} />
}
