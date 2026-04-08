import { describe, expect, it } from 'vitest';
import {
  createParser,
  HtmlParser,
  JsonParser,
  MarkdownParser,
  PdfParser,
  PlainTextParser,
} from '../ingestion/file-parsers.js';

describe('PlainTextParser', () => {
  it('normalizes CRLF to LF', () => {
    const parser = new PlainTextParser();
    const { text } = parser.parse('line1\r\nline2\r\nline3');
    expect(text).toBe('line1\nline2\nline3');
  });

  it('trims leading and trailing whitespace', () => {
    const parser = new PlainTextParser();
    const { text } = parser.parse('   hello   ');
    expect(text).toBe('hello');
  });
});

describe('MarkdownParser', () => {
  it('strips frontmatter', () => {
    const parser = new MarkdownParser();
    const { text } = parser.parse('---\ntitle: Test\n---\nContent here');
    expect(text).not.toContain('title:');
    expect(text).toContain('Content here');
  });

  it('strips heading markers but keeps text', () => {
    const parser = new MarkdownParser();
    const { text } = parser.parse('# Heading One\n## Heading Two\nBody');
    expect(text).not.toContain('#');
    expect(text).toContain('Heading One');
    expect(text).toContain('Heading Two');
    expect(text).toContain('Body');
  });

  it('unwraps bold and italic markers', () => {
    const parser = new MarkdownParser();
    const { text } = parser.parse('This is **bold** and _italic_');
    expect(text).not.toContain('**');
    expect(text).not.toContain('_italic_');
    expect(text).toContain('bold');
    expect(text).toContain('italic');
  });

  it('converts links to text only', () => {
    const parser = new MarkdownParser();
    const { text } = parser.parse('[Click here](https://example.com)');
    expect(text).toContain('Click here');
    expect(text).not.toContain('https://example.com');
  });

  it('removes images entirely', () => {
    const parser = new MarkdownParser();
    const { text } = parser.parse('![alt text](image.png)');
    expect(text).not.toContain('![');
    expect(text).not.toContain('image.png');
  });

  it('strips code fence markers but keeps content', () => {
    const parser = new MarkdownParser();
    const { text } = parser.parse('```js\nconsole.log("hi")\n```');
    expect(text).toContain('console.log');
    expect(text).not.toContain('```');
  });
});

describe('HtmlParser', () => {
  it('strips HTML tags', () => {
    const parser = new HtmlParser();
    const { text } = parser.parse('<p>Hello <strong>world</strong></p>');
    expect(text).not.toContain('<p>');
    expect(text).not.toContain('<strong>');
    expect(text).toContain('Hello');
    expect(text).toContain('world');
  });

  it('removes script and style blocks', () => {
    const parser = new HtmlParser();
    const { text } = parser.parse('<script>alert("xss")</script><p>Content</p>');
    expect(text).not.toContain('alert');
    expect(text).toContain('Content');
  });

  it('decodes HTML entities', () => {
    const parser = new HtmlParser();
    const { text } = parser.parse('&amp; &lt; &gt; &quot; &nbsp;');
    expect(text).toContain('&');
    expect(text).toContain('<');
    expect(text).toContain('>');
  });

  it('removes HTML comments', () => {
    const parser = new HtmlParser();
    const { text } = parser.parse('<!-- secret --> visible');
    expect(text).not.toContain('secret');
    expect(text).toContain('visible');
  });
});

describe('JsonParser', () => {
  it('pretty-prints valid JSON', () => {
    const parser = new JsonParser();
    const { text } = parser.parse('{"key":"value","num":42}');
    expect(text).toContain('"key"');
    expect(text).toContain('"value"');
    expect(text).toContain('42');
  });

  it('returns raw text for invalid JSON', () => {
    const parser = new JsonParser();
    const { text } = parser.parse('not json at all');
    expect(text).toBe('not json at all');
  });
});

describe('createParser factory', () => {
  it('returns MarkdownParser for text/markdown', () => {
    const parser = createParser('text/markdown');
    expect(parser).toBeInstanceOf(MarkdownParser);
  });

  it('returns HtmlParser for text/html', () => {
    const parser = createParser('text/html');
    expect(parser).toBeInstanceOf(HtmlParser);
  });

  it('returns JsonParser for application/json', () => {
    const parser = createParser('application/json');
    expect(parser).toBeInstanceOf(JsonParser);
  });

  it('returns PdfParser for application/pdf', () => {
    const parser = createParser('application/pdf');
    expect(parser).toBeInstanceOf(PdfParser);
  });

  it('returns PlainTextParser for unknown mime type', () => {
    const parser = createParser('application/octet-stream');
    expect(parser).toBeInstanceOf(PlainTextParser);
  });

  it('handles mime type with charset parameter', () => {
    const parser = createParser('text/html; charset=utf-8');
    expect(parser).toBeInstanceOf(HtmlParser);
  });
});

// Minimal hand-crafted PDF byte sequence for testing.
// BT…ET block containing "(Hello World) Tj" plus a /Count entry.
function buildMinimalPdf(text: string, pageCount = 1): Buffer {
  const stream = `BT\n(${text}) Tj\nET`;
  const body = ['%PDF-1.4', `/Count ${pageCount}`, stream, '%%EOF'].join('\n');
  return Buffer.from(body, 'binary');
}

describe('PdfParser', () => {
  it('extracts text from a Tj operator', () => {
    const buf = buildMinimalPdf('Hello World');
    const parser = new PdfParser();
    const { text } = parser.parseBuffer(buf);
    expect(text).toContain('Hello World');
  });

  it('reads page count from /Count', () => {
    const buf = buildMinimalPdf('test', 5);
    const parser = new PdfParser();
    const result = parser.parseBuffer(buf);
    expect(result.metadata.pageCount).toBe(5);
  });

  it('returns empty text for a PDF with no BT/ET blocks', () => {
    const buf = Buffer.from('%PDF-1.4\n/Count 1\n%%EOF', 'binary');
    const parser = new PdfParser();
    const { text } = parser.parseBuffer(buf);
    expect(text).toBe('');
  });

  it('decodes backslash escape sequences in literal strings', () => {
    // \n inside a PDF literal string should become a newline
    const stream = 'BT\n(line1\\nline2) Tj\nET';
    const buf = Buffer.from(`%PDF-1.4\n${stream}\n%%EOF`, 'binary');
    const parser = new PdfParser();
    const { text } = parser.parseBuffer(buf);
    expect(text).toContain('line1');
    expect(text).toContain('line2');
  });

  it('parse() delegates to parseBuffer via binary encoding', () => {
    const stream = 'BT\n(SyncText) Tj\nET';
    const raw = `%PDF-1.4\n${stream}\n%%EOF`;
    const parser = new PdfParser();
    const { text } = parser.parse(raw);
    expect(text).toContain('SyncText');
  });

  it('createParser returns PdfParser for application/pdf', () => {
    expect(createParser('application/pdf')).toBeInstanceOf(PdfParser);
  });
});
