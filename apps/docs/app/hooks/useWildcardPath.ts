import { useParams } from '@revealui/router';

/**
 * Extract a wildcard route parameter and return it as a joined string.
 * @revealui/router captures wildcards as string[] (split by '/').
 * This hook joins them back for compatibility with doc path resolution.
 */
export function useWildcardPath(name = 'path'): string | undefined {
  const params = useParams<Record<string, string | string[]>>();
  const value = params[name];
  if (Array.isArray(value)) return value.join('/');
  return value;
}
