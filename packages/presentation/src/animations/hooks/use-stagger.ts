'use client';

import { useMemo } from 'react';

export interface StaggerConfig {
  /** Delay between each item in milliseconds (default: 50) */
  delay?: number;
  /** Direction of stagger (default: 'forward') */
  direction?: 'forward' | 'reverse';
}

/**
 * Generate staggered delay values for a list of items.
 *
 * Returns an array of delays (in ms) to pass to each item's animation.
 *
 * @example
 * ```tsx
 * const items = ['a', 'b', 'c', 'd'];
 * const delays = useStagger(items.length, { delay: 80 });
 *
 * return items.map((item, i) => (
 *   <div
 *     key={item}
 *     style={{
 *       animation: `fadeIn 300ms ease-out ${delays[i]}ms both`,
 *     }}
 *   >
 *     {item}
 *   </div>
 * ));
 * ```
 */
export function useStagger(count: number, config?: StaggerConfig): number[] {
  const delay = config?.delay ?? 50;
  const direction = config?.direction ?? 'forward';

  return useMemo(() => {
    const delays = Array.from({ length: count }, (_, i) => i * delay);
    return direction === 'reverse' ? delays.reverse() : delays;
  }, [count, delay, direction]);
}
