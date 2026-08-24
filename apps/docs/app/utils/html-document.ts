/**
 * Detect SPA-fallback HTML that Vite/Vercel serve for unknown paths.
 *
 * Missing `.md` fetches on the static host rewrite to `/index.html` with
 * HTTP 200 (sometimes still advertised as `text/markdown`). Treating that
 * body as a doc paints `<!DOCTYPE html>` as the article.
 */

const HTML_TYPE = 'text/html';
const DOCTYPE_HTML = '<!doctype html';
const HTML_TAG = '<html';

function leadingWhitespaceEnd(value: string): number {
  let i = 0;
  while (i < value.length) {
    const ch = value[i];
    if (ch !== ' ' && ch !== '\n' && ch !== '\r' && ch !== '\t') {
      break;
    }
    i += 1;
  }
  return i;
}

export function isHtmlDocumentContent(content: string, contentType?: string | null): boolean {
  const type = (contentType ?? '').toLowerCase();
  if (type.includes(HTML_TYPE)) {
    return true;
  }

  const start = leadingWhitespaceEnd(content);
  const head = content.slice(start, start + DOCTYPE_HTML.length).toLowerCase();
  return head.startsWith(DOCTYPE_HTML) || head.startsWith(HTML_TAG);
}
