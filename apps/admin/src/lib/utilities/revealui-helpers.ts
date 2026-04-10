/**
 * Helper functions for integrating RevealUI theme components with admin data
 */

import type { Page, Post } from '@revealui/core/types/admin';
import type { FooterType } from '@/lib/globals/Footer/Component';
import type { HeaderType } from '@/lib/globals/Header/Component';

/**
 * Resolves an admin link to a URL string
 * Handles both custom URLs and references to pages/posts
 */
export function getLinkUrl(
  link:
    | NonNullable<HeaderType['navItems']>[0]['link']
    | NonNullable<FooterType['navItems']>[0]['link'],
): string {
  // Custom URL
  if (link.type === 'custom' && link.url) {
    return link.url;
  }

  // Reference link
  if (link.type === 'reference' && link.reference) {
    const { relationTo, value } = link.reference;

    // If value is an object (populated), use its slug
    if (typeof value === 'object' && value !== null && 'slug' in value) {
      const slug = (value as Page | Post).slug;
      if (relationTo === 'pages') {
        return `/${String(slug)}`;
      }
      if (relationTo === 'posts') {
        return `/posts/${String(slug)}`;
      }
    }

    // If value is a string/number (ID), it hasn't been populated.
    // Return a disabled-looking link rather than a broken '#' navigation.
    if (typeof value === 'string' || typeof value === 'number') {
      return `/${relationTo}/${String(value)}`;
    }
  }

  return '/';
}

/**
 * Gets the label for an admin link
 * Header links have a label field, Footer links might not
 */
export function getLinkLabel(
  link:
    | NonNullable<HeaderType['navItems']>[0]['link']
    | NonNullable<FooterType['navItems']>[0]['link'],
): string {
  // Header links have a label field
  if ('label' in link && link.label) {
    return link.label;
  }

  // For footer links or links without labels, try to get from reference
  if (link.type === 'reference' && link.reference) {
    const { value } = link.reference;
    if (typeof value === 'object' && value !== null && 'title' in value) {
      return (value as Page | Post).title || 'Untitled';
    }
  }

  return 'Untitled';
}
