import type { Page, Post } from '@revealui/core/types/admin';
import { Button, type ButtonProps, cn } from '@revealui/presentation/server';
import { sanitizeUrl } from '@revealui/security/sanitize';
import Link from 'next/link';
import type React from 'react';

// CMS link styles. `inline` renders plain rich-text link; the rest map to the
// owned Button's two-axis API below. `default`/`outline` are the Payload link
// field's `LinkAppearances`; `link` is a nav-only button-link style.
type CMSLinkAppearance = 'inline' | 'link' | 'default' | 'outline';

type CMSLinkType = {
  appearance?: CMSLinkAppearance | null;
  children?: React.ReactNode;
  className?: string;
  label?: string | null;
  newTab?: boolean | null;
  reference?: {
    relationTo: 'pages' | 'posts';
    value: Page | Post | string | number;
  } | null;
  size?: ButtonProps['size'] | null;
  type?: 'custom' | 'reference' | null;
  url?: string | null;
};

export const CMSLink = (props: CMSLinkType) => {
  const {
    type,
    appearance = 'inline',
    children,
    className,
    label,
    newTab,
    reference,
    size: sizeFromProps,
    url,
  } = props;

  const href =
    type === 'reference' && typeof reference?.value === 'object' && reference.value.slug
      ? `${reference?.relationTo !== 'pages' ? `/${reference?.relationTo}` : ''}/${
          reference.value.slug
        }`
      : url;

  if (!href) return null;

  // Single URL chokepoint for every CMS-authored link surface (inline rich
  // text, CTA and hero buttons). The stored url is author-controlled and
  // Next <Link> renders javascript: hrefs verbatim, so unsafe schemes must
  // collapse to '#' here.
  const safeHref = sanitizeUrl(href, 'link');

  const size = appearance === 'link' ? 'clear' : sizeFromProps;
  const newTabProps = newTab ? { rel: 'noopener noreferrer', target: '_blank' } : {};

  /* Ensure we don't break any styles set by richText */
  if (appearance === 'inline') {
    return (
      <Link className={cn(className)} href={safeHref} {...newTabProps}>
        {label}
        {children}
      </Link>
    );
  }

  // Map the CMS appearance onto the owned Button's semantic variant + visual
  // appearance axes. `default` is the brand solid CTA; `outline` is a neutral
  // outline; `link` is the text-link appearance.
  const buttonProps: Pick<ButtonProps, 'variant' | 'appearance'> =
    appearance === 'link'
      ? { appearance: 'link' }
      : appearance === 'outline'
        ? { appearance: 'outline', variant: 'neutral' }
        : { variant: 'brand' };

  return (
    <Button asChild className={className} size={size} {...buttonProps}>
      <Link className={cn(className)} href={safeHref} {...newTabProps}>
        {label}
        {children}
      </Link>
    </Button>
  );
};
