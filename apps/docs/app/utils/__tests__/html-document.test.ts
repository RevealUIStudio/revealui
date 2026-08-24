import { describe, expect, it } from 'vitest';
import { isHtmlDocumentContent } from '../html-document';

describe('isHtmlDocumentContent', () => {
  it('detects a Vite/Vercel SPA index.html body', () => {
    expect(
      isHtmlDocumentContent('<!DOCTYPE html>\n<html lang="en">\n<head></head>\n</html>\n'),
    ).toBe(true);
    expect(isHtmlDocumentContent('  <html lang="en"><body></body></html>')).toBe(true);
  });

  it('detects a text/html content type even when the body is short', () => {
    expect(isHtmlDocumentContent('ok', 'text/html; charset=utf-8')).toBe(true);
  });

  it('does not flag markdown that mentions HTML later', () => {
    expect(isHtmlDocumentContent('# Title\n\nUse `<html>` in examples.\n', 'text/markdown')).toBe(
      false,
    );
  });
});
