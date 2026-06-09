import { describe, expect, it } from 'vitest';
import { deriveDocMeta, extractExcerpt, extractTitle } from '../search-index';

describe('deriveDocMeta (frontmatter-aware)', () => {
  it('prefers the frontmatter title over a body H1', () => {
    const content = '---\ntitle: Front Title\n---\n\n# Body Heading\n\nBody text here.';
    expect(deriveDocMeta(content, 'some-slug').title).toBe('Front Title');
  });

  it('excerpts from the body, never the frontmatter block', () => {
    const content =
      '---\ntitle: My Post\ndescription: "*By Someone*"\n---\n\nThe first real paragraph of the post body.';
    const { excerpt } = deriveDocMeta(content, 'my-post');
    expect(excerpt).toBe('The first real paragraph of the post body.');
    expect(excerpt).not.toContain('title:');
    expect(excerpt).not.toContain('description');
  });

  it('falls back to the body H1 when there is no frontmatter title', () => {
    const content = '# Just an H1\n\nSome body text that is long enough.';
    expect(deriveDocMeta(content, 'slug').title).toBe('Just an H1');
  });

  it('falls back to the slug when there is neither', () => {
    const content = 'No heading, no frontmatter, just prose long enough to be an excerpt.';
    expect(deriveDocMeta(content, 'fallback-slug').title).toBe('fallback-slug');
  });

  it('keeps extractTitle/extractExcerpt working on plain markdown', () => {
    expect(extractTitle('# Hello\n\nWorld')).toBe('Hello');
    expect(extractExcerpt('# Hello\n\nThis is the body paragraph.')).toBe(
      'This is the body paragraph.',
    );
  });
});
