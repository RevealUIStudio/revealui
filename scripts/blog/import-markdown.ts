#!/usr/bin/env tsx

/**
 * Markdown → CMS Blog Importer
 *
 * Parses a markdown file and creates a CMS post via the RevealUI engine.
 * Content is stored as Lexical JSON (the CMS rich text format).
 *
 * Usage:
 *   tsx scripts/blog/import-markdown.ts <markdown-file> [--slug=custom-slug] [--status=draft|published] [--dry-run]
 *
 * Examples:
 *   tsx scripts/blog/import-markdown.ts docs/blog/01-why-we-built-revealui.md
 *   tsx scripts/blog/import-markdown.ts docs/blog/01-why-we-built-revealui.md --slug=why-revealui --status=published
 *   tsx scripts/blog/import-markdown.ts docs/blog/01-why-we-built-revealui.md --dry-run
 */

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

// ─── Logging ──────────────────────────────────────────────────────────────────

const log = {
  info: (msg: string) => process.stdout.write(`${msg}\n`),
  success: (msg: string) => process.stdout.write(`\x1b[32m${msg}\x1b[0m\n`),
  error: (msg: string) => process.stderr.write(`\x1b[31m${msg}\x1b[0m\n`),
  dim: (msg: string) => process.stdout.write(`\x1b[2m${msg}\x1b[0m\n`),
};

// ─── Lexical Node Builders ───────────────────────────────────────────────────

/** Lexical text format bitmask flags */
const FORMAT = {
  BOLD: 1,
  ITALIC: 2,
  STRIKETHROUGH: 4,
  UNDERLINE: 8,
  CODE: 16,
} as const;

interface LexicalTextNode {
  type: 'text';
  detail: 0;
  format: number;
  mode: 'normal';
  style: '';
  text: string;
  version: 1;
}

interface LexicalLineBreakNode {
  type: 'linebreak';
  version: 1;
}

type LexicalInlineNode = LexicalTextNode | LexicalLinkNode | LexicalLineBreakNode;

interface LexicalLinkNode {
  type: 'link';
  children: LexicalTextNode[];
  direction: 'ltr';
  format: '';
  indent: 0;
  version: 3;
  rel: 'noopener noreferrer';
  target: '_blank' | null;
  title: '' | null;
  url: string;
}

interface LexicalParagraphNode {
  type: 'paragraph';
  children: LexicalInlineNode[];
  direction: 'ltr';
  format: '';
  indent: 0;
  textFormat: 0;
  textStyle: '';
  version: 1;
}

interface LexicalHeadingNode {
  type: 'heading';
  children: LexicalInlineNode[];
  direction: 'ltr';
  format: '';
  indent: 0;
  tag: 'h1' | 'h2' | 'h3' | 'h4';
  version: 1;
}

interface LexicalCodeNode {
  type: 'code';
  children: LexicalTextNode[];
  direction: 'ltr';
  format: '';
  indent: 0;
  language: string;
  version: 1;
}

interface LexicalListItemNode {
  type: 'listitem';
  children: LexicalInlineNode[];
  direction: 'ltr';
  format: '';
  indent: 0;
  value: number;
  version: 1;
}

interface LexicalListNode {
  type: 'list';
  children: LexicalListItemNode[];
  direction: 'ltr';
  format: '';
  indent: 0;
  listType: 'bullet' | 'number';
  start: 1;
  tag: 'ul' | 'ol';
  version: 1;
}

interface LexicalHorizontalRuleNode {
  type: 'horizontalrule';
  version: 1;
}

interface LexicalQuoteNode {
  type: 'quote';
  children: LexicalInlineNode[];
  direction: 'ltr';
  format: '';
  indent: 0;
  version: 1;
}

type LexicalBlockNode =
  | LexicalParagraphNode
  | LexicalHeadingNode
  | LexicalCodeNode
  | LexicalListNode
  | LexicalHorizontalRuleNode
  | LexicalQuoteNode;

function textNode(text: string, format = 0): LexicalTextNode {
  return { type: 'text', detail: 0, format, mode: 'normal', style: '', text, version: 1 };
}

function lineBreakNode(): LexicalLineBreakNode {
  return { type: 'linebreak', version: 1 };
}

function linkNode(url: string, text: string): LexicalLinkNode {
  return {
    type: 'link',
    children: [textNode(text)],
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 3,
    rel: 'noopener noreferrer',
    target: url.startsWith('http') ? '_blank' : null,
    title: null,
    url,
  };
}

function paragraphNode(children: LexicalInlineNode[]): LexicalParagraphNode {
  return {
    type: 'paragraph',
    children,
    direction: 'ltr',
    format: '',
    indent: 0,
    textFormat: 0,
    textStyle: '',
    version: 1,
  };
}

function headingNode(
  children: LexicalInlineNode[],
  tag: 'h1' | 'h2' | 'h3' | 'h4',
): LexicalHeadingNode {
  return { type: 'heading', children, direction: 'ltr', format: '', indent: 0, tag, version: 1 };
}

function codeNode(code: string, language: string): LexicalCodeNode {
  return {
    type: 'code',
    children: [textNode(code)],
    direction: 'ltr',
    format: '',
    indent: 0,
    language: language || 'plaintext',
    version: 1,
  };
}

function listNode(items: LexicalListItemNode[], ordered: boolean): LexicalListNode {
  return {
    type: 'list',
    children: items,
    direction: 'ltr',
    format: '',
    indent: 0,
    listType: ordered ? 'number' : 'bullet',
    start: 1,
    tag: ordered ? 'ol' : 'ul',
    version: 1,
  };
}

function listItemNode(children: LexicalInlineNode[], value: number): LexicalListItemNode {
  return {
    type: 'listitem',
    children,
    direction: 'ltr',
    format: '',
    indent: 0,
    value,
    version: 1,
  };
}

function horizontalRuleNode(): LexicalHorizontalRuleNode {
  return { type: 'horizontalrule', version: 1 };
}

function quoteNode(children: LexicalInlineNode[]): LexicalQuoteNode {
  return { type: 'quote', children, direction: 'ltr', format: '', indent: 0, version: 1 };
}

function richTextDoc(children: LexicalBlockNode[]) {
  return {
    root: {
      type: 'root',
      children,
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  };
}

// ─── Inline Markdown Parser ──────────────────────────────────────────────────

/**
 * Parses inline markdown (bold, italic, code, links) into Lexical inline nodes.
 */
function parseInline(text: string): LexicalInlineNode[] {
  const nodes: LexicalInlineNode[] = [];
  let i = 0;

  while (i < text.length) {
    // Inline code: `code`
    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1);
      if (end !== -1) {
        nodes.push(textNode(text.slice(i + 1, end), FORMAT.CODE));
        i = end + 1;
        continue;
      }
    }

    // Link: [text](url)
    if (text[i] === '[') {
      const closeBracket = text.indexOf(']', i + 1);
      if (closeBracket !== -1 && text[closeBracket + 1] === '(') {
        const closeParen = text.indexOf(')', closeBracket + 2);
        if (closeParen !== -1) {
          const linkText = text.slice(i + 1, closeBracket);
          const url = text.slice(closeBracket + 2, closeParen);
          nodes.push(linkNode(url, linkText));
          i = closeParen + 1;
          continue;
        }
      }
    }

    // Bold+Italic: ***text*** or ___text___
    if (
      (text[i] === '*' || text[i] === '_') &&
      text[i + 1] === text[i] &&
      text[i + 2] === text[i]
    ) {
      const marker = text[i];
      const tripleMarker = marker + marker + marker;
      const end = text.indexOf(tripleMarker, i + 3);
      if (end !== -1) {
        nodes.push(textNode(text.slice(i + 3, end), FORMAT.BOLD | FORMAT.ITALIC));
        i = end + 3;
        continue;
      }
    }

    // Bold: **text** or __text__
    if ((text[i] === '*' || text[i] === '_') && text[i + 1] === text[i]) {
      const marker = text[i];
      const doubleMarker = marker + marker;
      const end = text.indexOf(doubleMarker, i + 2);
      if (end !== -1) {
        nodes.push(textNode(text.slice(i + 2, end), FORMAT.BOLD));
        i = end + 2;
        continue;
      }
    }

    // Italic: *text* or _text_ (not at word boundary for _)
    if (text[i] === '*' && text[i + 1] !== '*') {
      const end = text.indexOf('*', i + 1);
      if (end !== -1) {
        nodes.push(textNode(text.slice(i + 1, end), FORMAT.ITALIC));
        i = end + 1;
        continue;
      }
    }

    // Plain text  -  accumulate until next special character
    let end = i + 1;
    while (end < text.length && !'`[*_'.includes(text[end])) {
      end++;
    }
    nodes.push(textNode(text.slice(i, end)));
    i = end;
  }

  return nodes;
}

// ─── Block Markdown Parser ───────────────────────────────────────────────────

interface ParseResult {
  title: string;
  subtitle: string | null;
  nodes: LexicalBlockNode[];
}

/**
 * Parses a markdown string into Lexical block nodes.
 * Extracts the first H1 as the post title.
 */
function parseMarkdown(markdown: string): ParseResult {
  const lines = markdown.split('\n');
  const nodes: LexicalBlockNode[] = [];
  let title = '';
  let subtitle: string | null = null;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Fenced code block: ```lang
    if (line.trimStart().startsWith('```')) {
      const language = line.trimStart().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      nodes.push(codeNode(codeLines.join('\n'), language));
      continue;
    }

    // Horizontal rule: --- or *** or ___
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
      // Skip if it's the first --- after title (subtitle separator)
      if (nodes.length === 0 && title) {
        i++;
        continue;
      }
      nodes.push(horizontalRuleNode());
      i++;
      continue;
    }

    // Headings: # to ####
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const depth = headingMatch[1].length as 1 | 2 | 3 | 4;
      const text = headingMatch[2];

      // First h1 becomes the post title
      if (depth === 1 && !title) {
        title = text;
        i++;
        continue;
      }

      const tag = `h${Math.min(depth, 4)}` as 'h1' | 'h2' | 'h3' | 'h4';
      nodes.push(headingNode(parseInline(text), tag));
      i++;
      continue;
    }

    // Blockquote: > text
    if (line.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      const quoteText = quoteLines.join(' ');
      nodes.push(quoteNode(parseInline(quoteText)));
      continue;
    }

    // Ordered list: 1. text
    if (/^\d+\.\s/.test(line)) {
      const items: LexicalListItemNode[] = [];
      let itemNum = 1;
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        const itemText = lines[i].replace(/^\d+\.\s+/, '');
        items.push(listItemNode(parseInline(itemText), itemNum));
        itemNum++;
        i++;
      }
      nodes.push(listNode(items, true));
      continue;
    }

    // Unordered list: - text or * text
    if (/^[-*]\s/.test(line)) {
      const items: LexicalListItemNode[] = [];
      let itemNum = 1;
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        const itemText = lines[i].replace(/^[-*]\s+/, '');
        items.push(listItemNode(parseInline(itemText), itemNum));
        itemNum++;
        i++;
      }
      nodes.push(listNode(items, false));
      continue;
    }

    // Subtitle line: *By Author  -  Studio* (italic line right after title)
    if (!subtitle && nodes.length === 0 && /^\*[^*]+\*$/.test(line.trim())) {
      subtitle = line.trim().slice(1, -1);
      i++;
      continue;
    }

    // Regular paragraph  -  may span multiple non-blank lines
    const paraLines: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('```') &&
      !lines[i].startsWith('>') &&
      !/^(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i].trim()) &&
      !/^\d+\.\s/.test(lines[i]) &&
      !/^[-*]\s/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    const paraText = paraLines.join('\n');

    // Multi-line paragraph: join with line breaks for hard breaks, or spaces for soft wraps
    // Markdown spec: lines ending with 2+ spaces = hard break, otherwise soft wrap
    const finalLines = paraText.split('\n');
    const inlineNodes: LexicalInlineNode[] = [];
    for (let li = 0; li < finalLines.length; li++) {
      if (li > 0) {
        // Check if previous line ended with 2+ spaces (hard break)
        if (finalLines[li - 1].endsWith('  ')) {
          inlineNodes.push(lineBreakNode());
        } else {
          // Soft wrap  -  join with space
          inlineNodes.push(textNode(' '));
        }
      }
      inlineNodes.push(...parseInline(finalLines[li].trimEnd()));
    }
    nodes.push(paragraphNode(inlineNodes));
  }

  return { title, subtitle, nodes };
}

// ─── Slug Generation ─────────────────────────────────────────────────────────

function generateSlug(filename: string): string {
  return basename(filename, '.md')
    .replace(/^\d+-/, '') // strip leading number prefix like "01-"
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const filePath = args.find((a) => !a.startsWith('--'));
  const dryRun = args.includes('--dry-run');
  const slugArg = args.find((a) => a.startsWith('--slug='))?.split('=')[1];
  const statusArg =
    (args.find((a) => a.startsWith('--status='))?.split('=')[1] as 'draft' | 'published') ??
    'draft';

  if (!filePath) {
    log.error(
      'Usage: tsx scripts/blog/import-markdown.ts <markdown-file> [--slug=...] [--status=draft|published] [--dry-run]',
    );
    process.exit(1);
  }

  // Read and parse markdown
  log.info(`Reading ${filePath}...`);
  const markdown = readFileSync(filePath, 'utf-8');
  const { title, subtitle, nodes } = parseMarkdown(markdown);

  if (!title) {
    log.error('No H1 heading found in markdown  -  cannot determine post title.');
    process.exit(1);
  }

  const slug = slugArg ?? generateSlug(filePath);
  const content = richTextDoc(nodes);

  // Build excerpt from subtitle or first paragraph
  const excerpt =
    subtitle ??
    (nodes.find((n): n is LexicalParagraphNode => n.type === 'paragraph')?.children ?? [])
      .filter((c): c is LexicalTextNode => c.type === 'text')
      .map((c) => c.text)
      .join('')
      .slice(0, 200);

  log.info(`\nTitle:   ${title}`);
  log.info(`Slug:    ${slug}`);
  log.info(`Status:  ${statusArg}`);
  log.info(`Excerpt: ${excerpt.slice(0, 80)}...`);
  log.info(`Nodes:   ${nodes.length} block nodes`);
  log.dim(`         ${nodes.map((n) => n.type).join(', ')}`);

  if (dryRun) {
    log.info('\n--- Lexical JSON (first 3 nodes) ---');
    const preview = {
      ...content,
      root: { ...content.root, children: content.root.children.slice(0, 3) },
    };
    log.info(JSON.stringify(preview, null, 2));
    log.success('\n[dry-run] No post created.');
    return;
  }

  // Create post via RevealUI engine
  log.info('\nInitializing runtime engine...');

  const [{ default: config }, { getRevealUI }] = await Promise.all([
    import('@reveal-config'),
    import('@revealui/core'),
  ]);

  const revealuiConfig = await config;
  const revealui = await getRevealUI({ config: revealuiConfig });

  // Check if post already exists
  const existing = await revealui.find({
    collection: 'posts',
    where: { slug: { equals: slug } } as never,
    limit: 1,
  });

  if (existing.docs && existing.docs.length > 0) {
    log.error(
      `Post with slug "${slug}" already exists. Use a different --slug or delete the existing post.`,
    );
    process.exit(1);
  }

  const post = await revealui.create({
    collection: 'posts',
    data: {
      title,
      slug,
      content,
      _status: statusArg,
      publishedAt: statusArg === 'published' ? new Date().toISOString() : undefined,
      meta: {
        title,
        description: excerpt,
      },
    } as never,
  });

  log.success(`\nPost created: "${title}" (slug: ${slug})`);
  log.info(`ID: ${(post as { id?: string }).id ?? 'unknown'}`);
  log.info(`Status: ${statusArg}`);
  log.info('\nView in CMS: /admin/collections/posts');
}

main().catch((error) => {
  log.error(`Fatal: ${error instanceof Error ? error.message : String(error)}`);
  if (error instanceof Error && error.stack) {
    log.dim(error.stack);
  }
  process.exit(1);
});
