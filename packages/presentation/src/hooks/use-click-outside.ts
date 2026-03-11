import { type RefObject, useEffect, useRef } from 'react';

export function useClickOutside(
  refs: RefObject<HTMLElement | null> | RefObject<HTMLElement | null>[],
  onClickOutside: () => void,
  enabled = true,
): void {
  const callbackRef = useRef(onClickOutside);
  callbackRef.current = onClickOutside;

  useEffect(() => {
    if (!enabled) return;

    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node;
      const refArray = Array.isArray(refs) ? refs : [refs];
      const isOutside = refArray.every((ref) => !ref.current?.contains(target));
      if (isOutside) {
        callbackRef.current();
      }
    }

    // Use pointerdown on capture phase to fire before focus changes
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [refs, enabled]);
}
