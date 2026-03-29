'use client';

import { useEffect, useRef, useState } from 'react';

interface PresenceState {
  /** Whether the element should be rendered in the DOM */
  mounted: boolean;
  /** Whether the element is in its "present" (visible) state */
  present: boolean;
  /** Ref callback to attach to the animated element */
  ref: (node: HTMLElement | null) => void;
}

/**
 * Manage mount/unmount animations.
 *
 * Keeps an element in the DOM during its exit animation,
 * then unmounts it after the animation completes.
 *
 * This is RevealUI's replacement for Motion's AnimatePresence.
 *
 * @example
 * ```tsx
 * function FadePanel({ show }: { show: boolean }) {
 *   const { mounted, present, ref } = usePresence(show);
 *
 *   if (!mounted) return null;
 *
 *   return (
 *     <div
 *       ref={ref}
 *       style={{
 *         opacity: present ? 1 : 0,
 *         transition: 'opacity 200ms ease-out',
 *       }}
 *     >
 *       Content
 *     </div>
 *   );
 * }
 * ```
 */
export function usePresence(show: boolean, exitDuration = 200): PresenceState {
  const [mounted, setMounted] = useState(show);
  const [present, setPresent] = useState(show);
  const nodeRef = useRef<HTMLElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (show) {
      // Mount immediately, then set present on next frame for CSS transition
      setMounted(true);
      // Use double rAF to ensure the element is painted before transitioning
      let cancelled = false;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cancelled) setPresent(true);
        });
      });
      return () => {
        cancelled = true;
      };
    } else {
      // Start exit animation
      setPresent(false);

      // Try to detect transition end on the element
      const node = nodeRef.current;
      if (node) {
        const handleEnd = () => {
          setMounted(false);
          if (timerRef.current) clearTimeout(timerRef.current);
        };

        node.addEventListener('transitionend', handleEnd, { once: true });

        // Fallback timeout in case transitionend doesn't fire
        timerRef.current = setTimeout(() => {
          setMounted(false);
          node.removeEventListener('transitionend', handleEnd);
        }, exitDuration + 50);

        return () => {
          node.removeEventListener('transitionend', handleEnd);
          if (timerRef.current) clearTimeout(timerRef.current);
        };
      }

      // No node — just unmount after duration
      timerRef.current = setTimeout(() => setMounted(false), exitDuration);
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }
  }, [show, exitDuration]);

  const ref = (node: HTMLElement | null) => {
    nodeRef.current = node;
  };

  return { mounted, present, ref };
}
