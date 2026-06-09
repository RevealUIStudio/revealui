/**
 * Minimal, dependency-free readers for the two S3/R2 XML responses we consume:
 * ListObjectsV2 results and `<Error>` bodies. Replaces the XML codec that
 * @aws-sdk/client-s3 used to run for us.
 *
 * No regex (M2): a tag's text can never contain a raw `<` (XML escapes it to
 * `&lt;`), so `indexOf`-based tag scanning is unambiguous.
 */

/** First `<tag>…</tag>` text content at or after `from`, or undefined. */
function firstTagValue(xml: string, tag: string, from = 0): string | undefined {
  const open = `<${tag}>`;
  const start = xml.indexOf(open, from);
  if (start === -1) return undefined;
  const contentStart = start + open.length;
  const end = xml.indexOf(`</${tag}>`, contentStart);
  if (end === -1) return undefined;
  return xml.slice(contentStart, end);
}

/** Decode the five predefined XML entities (no regex). `&amp;` is decoded last. */
function decodeXmlEntities(value: string): string {
  if (!value.includes('&')) return value;
  return value
    .split('&lt;')
    .join('<')
    .split('&gt;')
    .join('>')
    .split('&quot;')
    .join('"')
    .split('&apos;')
    .join("'")
    .split('&amp;')
    .join('&');
}

export interface ListedObject {
  key: string;
  size: number;
  lastModified: Date;
}

export interface ParsedList {
  objects: ListedObject[];
  isTruncated: boolean;
  nextContinuationToken?: string;
}

/** Parse an S3 ListObjectsV2 XML response into the fields the R2 provider needs. */
export function parseListObjectsV2(xml: string): ParsedList {
  const objects: ListedObject[] = [];
  const contentsOpen = '<Contents>';
  const contentsClose = '</Contents>';
  let cursor = 0;
  for (;;) {
    const start = xml.indexOf(contentsOpen, cursor);
    if (start === -1) break;
    const end = xml.indexOf(contentsClose, start);
    if (end === -1) break;
    const block = xml.slice(start + contentsOpen.length, end);
    const key = firstTagValue(block, 'Key');
    if (key !== undefined) {
      const lastModified = firstTagValue(block, 'LastModified');
      objects.push({
        key: decodeXmlEntities(key),
        size: Number(firstTagValue(block, 'Size') ?? '0') || 0,
        lastModified: lastModified ? new Date(lastModified) : new Date(0),
      });
    }
    cursor = end + contentsClose.length;
  }

  const token = firstTagValue(xml, 'NextContinuationToken');
  return {
    objects,
    isTruncated: firstTagValue(xml, 'IsTruncated') === 'true',
    nextContinuationToken: token !== undefined ? decodeXmlEntities(token) : undefined,
  };
}

/** Extract `<Code>`/`<Message>` from an S3 `<Error>` response for diagnostics. */
export function s3ErrorFields(xml: string): { code?: string; message?: string } {
  return {
    code: firstTagValue(xml, 'Code'),
    message: firstTagValue(xml, 'Message'),
  };
}
