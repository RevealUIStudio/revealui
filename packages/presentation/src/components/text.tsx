import type React from 'react';
import { cn } from '../utils/cn.js';
import { focusRing } from '../utils/focus.js';
import { Link } from './link.js';

/**
 * Default product/marketing body text.
 * Uses the body type rung (`text-body` / rvui-text-1), not muted.
 * Use `text-muted-foreground` only for captions and meta via className override.
 */
export function Text({ className, ...props }: React.ComponentPropsWithoutRef<'p'>) {
  return (
    <p
      data-slot="text"
      {...props}
      className={cn(className, 'text-base/6 text-body sm:text-sm/6')}
    />
  );
}

export function TextLink({ className, ...props }: React.ComponentPropsWithoutRef<typeof Link>) {
  return (
    <Link
      {...props}
      className={cn(
        className,
        'text-foreground underline decoration-border-strong data-hover:decoration-foreground',
      )}
    />
  );
}

export function Strong({ className, ...props }: React.ComponentPropsWithoutRef<'strong'>) {
  return <strong {...props} className={cn(className, 'font-medium text-foreground')} />;
}

export function Code({ className, ...props }: React.ComponentPropsWithoutRef<'code'>) {
  return (
    <code
      {...props}
      className={cn(
        className,
        'rounded-sm border border-border bg-surface-2 px-0.5 text-sm font-medium text-foreground sm:text-[0.8125rem]',
      )}
    />
  );
}

const LINK_PROTOCOLS = new Set(['https:', 'http:', 'mailto:']);

/** Accept only http(s) and mailto. Anything else (javascript:, data:) is dropped. */
function safeHref(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.includes(' ') || trimmed.includes('\n')) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (!LINK_PROTOCOLS.has(url.protocol)) return null;
  return trimmed;
}

function parseInline(input: string, allow: { strong: boolean; link: boolean }): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let text = '';
  let i = 0;

  const flush = (): void => {
    if (text.length === 0) return;
    nodes.push(text);
    text = '';
  };

  while (i < input.length) {
    if (input.startsWith('`', i)) {
      const end = input.indexOf('`', i + 1);
      if (end !== -1) {
        flush();
        nodes.push(<Code key={`c${i}`}>{input.slice(i + 1, end)}</Code>);
        i = end + 1;
        continue;
      }
    }

    if (allow.strong && input.startsWith('**', i)) {
      const end = input.indexOf('**', i + 2);
      if (end !== -1) {
        flush();
        nodes.push(
          <Strong key={`s${i}`}>
            {parseInline(input.slice(i + 2, end), { strong: false, link: allow.link })}
          </Strong>,
        );
        i = end + 2;
        continue;
      }
    }

    if (allow.link && input.startsWith('[', i)) {
      const labelEnd = input.indexOf('](', i + 1);
      const hrefEnd = labelEnd === -1 ? -1 : input.indexOf(')', labelEnd + 2);
      const href = hrefEnd === -1 ? null : safeHref(input.slice(labelEnd + 2, hrefEnd));
      if (labelEnd !== -1 && hrefEnd !== -1 && href !== null) {
        flush();
        const external = href.startsWith('https://') || href.startsWith('http://');
        nodes.push(
          <Link
            key={`a${i}`}
            href={href}
            className="underline decoration-current underline-offset-2 wrap-anywhere"
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {parseInline(input.slice(i + 1, labelEnd), { strong: true, link: false })}
          </Link>,
        );
        i = hrefEnd + 1;
        continue;
      }
    }

    text += input[i] ?? '';
    i += 1;
  }

  flush();
  return nodes;
}

export interface MarkdownTextProps {
  /** Inline markdown: `**bold**`, `` `code` ``, and `[label](url)`. */
  text: string;
  className?: string;
}

/**
 * Inline markdown for prose that would otherwise print raw `**` and URLs.
 * Long tokens wrap (`overflow-wrap: anywhere`) so a 390px viewport does not
 * grow sideways. Link labels are the visible name; the URL stays in `href`.
 */
export function MarkdownText({ text, className }: MarkdownTextProps): React.JSX.Element {
  return (
    <span data-slot="markdown-text" className={cn('wrap-anywhere break-words', className)}>
      {parseInline(text, { strong: true, link: true })}
    </span>
  );
}

const SKIP_LINK_CLASS = [
  'sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60]',
  'focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground',
  focusRing,
].join(' ');

export interface SkipLinkProps extends Omit<React.ComponentPropsWithoutRef<'a'>, 'href'> {
  /** Target for the skip target. Defaults to `#main-content`. */
  href?: string;
}

/**
 * Keyboard skip link. `focus:z-[60]` sits above sticky headers that use
 * `z-50` (the marketing bar is `z-50` with a blur), so the label stays
 * readable on focus. Pass `className` if a consumer header stacks higher.
 */
export function SkipLink({
  href = '#main-content',
  className,
  children = 'Skip to content',
  ...props
}: SkipLinkProps): React.JSX.Element {
  return (
    <a data-slot="skip-link" href={href} className={cn(SKIP_LINK_CLASS, className)} {...props}>
      {children}
    </a>
  );
}
