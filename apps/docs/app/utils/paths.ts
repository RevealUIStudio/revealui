/**
 * Path resolution and sanitization utilities for documentation routes
 */

import { SLUG_TO_PATH } from '../lib/slug-manifest';

/**
 * Type-safe documentation section paths
 */
export type DocSection = 'docs' | 'guides' | 'api';

/**
 * Options for resolving documentation paths
 */
export interface ResolveDocPathOptions {
  /**
   * The section (guides, api, reference)
   */
  section: DocSection;
  /**
   * The route path from URL params (e.g., "getting-started" or "revealui-core/index")
   */
  routePath?: string | null;
  /**
   * Whether the path should have a .md extension
   * Default: true (will add .md if not present)
   */
  requireExtension?: boolean;
}

/**
 * Result of path resolution
 */
export interface ResolvedDocPath {
  /**
   * The resolved markdown file path (e.g., "/docs/guides/getting-started.md")
   */
  markdownPath: string;
  /**
   * The sanitized route path for display
   */
  displayPath: string;
  /**
   * Whether this is an index/root path
   */
  isIndex: boolean;
}

const hasControlChars = (value: string): boolean => {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }
  return false;
};

const stripControlChars = (value: string): string => {
  let result = '';
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) {
      continue;
    }
    result += value[i];
  }
  return result;
};

/**
 * Sanitize a file path to prevent directory traversal and other security issues
 */
export function sanitizePath(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove null bytes
  let sanitized = stripControlChars(input);

  // Normalize path separators
  sanitized = sanitized.replace(/\\/g, '/');

  // Remove leading/trailing slashes and whitespace
  sanitized = sanitized.trim().replace(/^\/+|\/+$/g, '');

  // Split into segments and filter
  const segments = sanitized.split('/').filter((segment) => {
    // Remove empty segments
    if (!segment) return false;

    // Remove current directory references
    if (segment === '.') return false;

    // Remove parent directory references (prevent traversal)
    if (segment === '..') return false;

    // Remove segments containing only dots (security: "....")
    if (/^\.+$/.test(segment)) return false;

    // Remove segments with control characters
    if (hasControlChars(segment)) return false;

    return true;
  });

  // Rejoin segments
  return segments.join('/');
}

/**
 * Resolve a documentation path to a markdown file path
 */
export function resolveDocPath(options: ResolveDocPathOptions): ResolvedDocPath {
  const { section, routePath, requireExtension = true } = options;

  // CHIP-3 D5a: docs files live at the root of /public, not under /public/docs.
  // The 'docs' section therefore serves from /, and api/guides serve from
  // /api/, /guides/.
  const basePath = section === 'docs' ? '/' : `/${section}/`;

  // Handle empty/null route path (index)
  if (!routePath || routePath === '') {
    return {
      markdownPath: section === 'docs' ? '/INDEX.md' : `${basePath}README.md`,
      displayPath: section,
      isIndex: true,
    };
  }

  // Sanitize the route path
  const sanitized = sanitizePath(routePath);

  if (!sanitized) {
    // If sanitization removed everything, default to index
    return {
      markdownPath: `${basePath}README.md`,
      displayPath: section,
      isIndex: true,
    };
  }

  // CHIP-3 D2b: 'docs' section route paths are lowercase-kebab slugs.
  // Resolve via the slug manifest to recover the original filename.
  if (section === 'docs') {
    const slugKey = sanitized.replace(/\.(md|mdx)$/, '');
    const original = SLUG_TO_PATH[slugKey];
    if (original) {
      return {
        markdownPath: `/${original}`,
        displayPath: sanitized,
        isIndex: false,
      };
    }
    // Fallback: treat the path as-is for unmapped slugs (recently added
    // docs not yet in the manifest, etc.). Surfaces 404 if the file
    // doesn't exist; user can rerun `pnpm --filter docs build:slug-manifest`.
    const withExt = sanitized.endsWith('.md') ? sanitized : `${sanitized}.md`;
    return {
      markdownPath: `/${withExt}`,
      displayPath: sanitized,
      isIndex: false,
    };
  }

  let resolvedPath = sanitized;

  // Handle different path formats
  if (resolvedPath.endsWith('.md') || resolvedPath.endsWith('.mdx')) {
    // Already has extension
    if (requireExtension) {
      // Keep as is
    } else {
      // Remove extension if not required
      resolvedPath = resolvedPath.replace(/\.(md|mdx)$/, '');
    }
  } else {
    // No extension - add it if required
    if (requireExtension) {
      // For API section, check if it's a package name (no slashes) vs nested path
      if (section === 'api' && !resolvedPath.includes('/')) {
        // Package name like "revealui-core" -> "revealui-core/README.md"
        resolvedPath = `${resolvedPath}/README.md`;
      } else if (section === 'api' && resolvedPath.includes('/')) {
        // Nested path like "revealui-core/index" -> "revealui-core/index.md"
        resolvedPath = `${resolvedPath}.md`;
      } else {
        // Guides/Reference: "getting-started" -> "getting-started.md"
        resolvedPath = `${resolvedPath}.md`;
      }
    }
  }

  return {
    markdownPath: `${basePath}${resolvedPath}`,
    displayPath: sanitized,
    isIndex: false,
  };
}

/**
 * Validate that a path is safe (doesn't contain traversal attempts, etc.)
 */
export function isPathSafe(input: string): boolean {
  if (!input || typeof input !== 'string') {
    return false;
  }

  // Check for directory traversal attempts
  if (input.includes('..')) {
    return false;
  }

  // Check for null bytes
  if (input.includes('\0')) {
    return false;
  }

  // Check for absolute paths (on Windows or Unix)
  if (/^([a-zA-Z]:|\/)/.test(input)) {
    return false;
  }

  // Check for control characters
  if (hasControlChars(input)) {
    return false;
  }

  return true;
}
