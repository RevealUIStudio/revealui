import { useEffect } from 'react';
import { setRobotsNoindex } from '../lib/head';

/** Set `<meta name="robots" content="noindex, nofollow">` while `active` is true.
 *  Clears the tag on deactivation and on unmount. */
export function useNoindex(active: boolean): void {
  useEffect(() => {
    setRobotsNoindex(active);
    return () => setRobotsNoindex(false);
  }, [active]);
}
