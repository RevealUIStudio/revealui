import { useCallback, useEffect, useRef, useState } from 'react';

interface UseTransitionReturn {
  /** Whether the element should be rendered in the DOM */
  mounted: boolean;
  /** Ref to attach to the transitioning element (listens for transitionend) */
  nodeRef: React.RefObject<HTMLElement | null>;
  /** Data attributes to spread on the transitioning element */
  transitionProps: {
    'data-closed'?: string;
    'data-enter'?: string;
    'data-leave'?: string;
    'data-transition'?: string;
  };
}

/**
 * Manages CSS transition lifecycle using data attributes.
 *
 * Enter sequence:
 *  1. Mount with `data-closed` + `data-enter` (element in hidden state)
 *  2. Next frame: remove `data-closed` (CSS transition triggers)
 *  3. On transitionend: remove `data-enter`
 *
 * Leave sequence:
 *  1. Add `data-closed` + `data-leave` (CSS transition to hidden state)
 *  2. On transitionend: unmount
 */
export function useTransition(show: boolean): UseTransitionReturn {
  const nodeRef = useRef<HTMLElement | null>(null);
  const [, setTick] = useState(0);
  const rerender = useCallback(() => setTick((t) => t + 1), []);

  // Phase tracks the transition state
  // Uses ref for synchronous access during rAF callbacks
  const phase = useRef<'hidden' | 'enter-from' | 'enter-to' | 'visible' | 'leave'>(
    show ? 'visible' : 'hidden',
  );

  const prevShow = useRef(show);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Clean up previous transition
    cleanupRef.current?.();
    cleanupRef.current = null;

    if (show && !prevShow.current) {
      // === ENTER ===
      phase.current = 'enter-from';
      rerender();

      const frame1 = requestAnimationFrame(() => {
        const frame2 = requestAnimationFrame(() => {
          if (phase.current !== 'enter-from') return;
          phase.current = 'enter-to';
          rerender();

          const node = nodeRef.current;
          if (!node) {
            phase.current = 'visible';
            rerender();
            return;
          }

          let cleaned = false;
          const done = () => {
            if (cleaned) return;
            cleaned = true;
            phase.current = 'visible';
            rerender();
          };

          node.addEventListener('transitionend', done, { once: true });
          const fallback = setTimeout(done, 500);

          cleanupRef.current = () => {
            cleaned = true;
            node.removeEventListener('transitionend', done);
            clearTimeout(fallback);
          };
        });

        cleanupRef.current = () => cancelAnimationFrame(frame2);
      });

      cleanupRef.current = () => cancelAnimationFrame(frame1);
    } else if (!show && prevShow.current) {
      // === LEAVE ===
      phase.current = 'leave';
      rerender();

      const node = nodeRef.current;
      if (!node) {
        phase.current = 'hidden';
        rerender();
        prevShow.current = show;
        return;
      }

      let cleaned = false;
      const done = () => {
        if (cleaned) return;
        cleaned = true;
        phase.current = 'hidden';
        rerender();
      };

      node.addEventListener('transitionend', done, { once: true });
      const fallback = setTimeout(done, 500);

      cleanupRef.current = () => {
        cleaned = true;
        node.removeEventListener('transitionend', done);
        clearTimeout(fallback);
      };
    }

    prevShow.current = show;
  }, [show, rerender]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  const p = phase.current;

  return {
    mounted: p !== 'hidden',
    nodeRef,
    transitionProps: {
      'data-closed': p === 'enter-from' || p === 'leave' || p === 'hidden' ? '' : undefined,
      'data-enter': p === 'enter-from' || p === 'enter-to' ? '' : undefined,
      'data-leave': p === 'leave' ? '' : undefined,
      'data-transition': p === 'enter-from' || p === 'enter-to' || p === 'leave' ? '' : undefined,
    },
  };
}
