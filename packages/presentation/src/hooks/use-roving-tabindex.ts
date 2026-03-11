import { useCallback, useRef, useState } from 'react';

interface UseRovingTabindexOptions {
  /** Total number of items in the list */
  itemCount: number;
  /** Initial active index (-1 for none) */
  initialIndex?: number;
  /** Orientation for arrow key handling */
  orientation?: 'vertical' | 'horizontal';
  /** Whether navigation wraps around */
  loop?: boolean;
  /** Callback when active index changes */
  onActiveChange?: (index: number) => void;
}

interface UseRovingTabindexReturn {
  /** Currently active (focused) item index */
  activeIndex: number;
  /** Set the active index programmatically */
  setActiveIndex: (index: number) => void;
  /** Props to spread on the container element */
  containerProps: {
    role: string;
    onKeyDown: (e: React.KeyboardEvent) => void;
  };
  /** Get props for an individual item */
  getItemProps: (index: number) => {
    tabIndex: number;
    'data-focus': string | undefined;
    ref: (el: HTMLElement | null) => void;
    onPointerEnter: () => void;
    onClick: () => void;
  };
}

export function useRovingTabindex({
  itemCount,
  initialIndex = -1,
  orientation = 'vertical',
  loop = true,
  onActiveChange,
}: UseRovingTabindexOptions): UseRovingTabindexReturn {
  const [activeIndex, setActiveIndexState] = useState(initialIndex);
  const itemRefs = useRef<Map<number, HTMLElement>>(new Map());

  const onActiveChangeRef = useRef(onActiveChange);
  onActiveChangeRef.current = onActiveChange;

  const setActiveIndex = useCallback((index: number) => {
    setActiveIndexState(index);
    onActiveChangeRef.current?.(index);

    // Focus the element
    const el = itemRefs.current.get(index);
    el?.focus();
  }, []);

  const moveFocus = useCallback(
    (direction: 1 | -1) => {
      if (itemCount === 0) return;

      let next = activeIndex + direction;

      if (loop) {
        if (next < 0) next = itemCount - 1;
        else if (next >= itemCount) next = 0;
      } else {
        next = Math.max(0, Math.min(itemCount - 1, next));
      }

      // Skip disabled items
      const el = itemRefs.current.get(next);
      if (el?.hasAttribute('data-disabled')) {
        // Try next in same direction
        const nextNext = next + direction;
        if (nextNext >= 0 && nextNext < itemCount) {
          setActiveIndex(nextNext);
          return;
        }
      }

      setActiveIndex(next);
    },
    [activeIndex, itemCount, loop, setActiveIndex],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const prevKey = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';
      const nextKey = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';

      switch (e.key) {
        case prevKey:
          e.preventDefault();
          moveFocus(-1);
          break;
        case nextKey:
          e.preventDefault();
          moveFocus(1);
          break;
        case 'Home':
          e.preventDefault();
          setActiveIndex(0);
          break;
        case 'End':
          e.preventDefault();
          setActiveIndex(itemCount - 1);
          break;
      }
    },
    [moveFocus, setActiveIndex, itemCount, orientation],
  );

  const getItemProps = useCallback(
    (index: number) => ({
      tabIndex: index === activeIndex ? 0 : -1,
      'data-focus': index === activeIndex ? '' : undefined,
      ref: (el: HTMLElement | null) => {
        if (el) {
          itemRefs.current.set(index, el);
        } else {
          itemRefs.current.delete(index);
        }
      },
      onPointerEnter: () => setActiveIndex(index),
      onClick: () => setActiveIndex(index),
    }),
    [activeIndex, setActiveIndex],
  );

  return {
    activeIndex,
    setActiveIndex,
    containerProps: {
      role: orientation === 'vertical' ? 'listbox' : 'group',
      onKeyDown,
    },
    getItemProps,
  };
}
