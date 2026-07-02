import type { Page, Post } from '@revealui/core/types/admin';
import { ButtonCVA as Button, type ButtonProps, cn } from '@revealui/presentation/server';
import { sanitizeUrl } from '@revealui/security/sanitize';
import Link from 'next/link';
import type React from 'react';

type CMSLinkType = {
  appearance?: 'inline' | ButtonProps['variant'];
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

  return (
    <Button asChild className={className} size={size} variant={appearance}>
      <Link className={cn(className)} href={safeHref} {...newTabProps}>
        {label}
        {children}
      </Link>
    </Button>
  );
};
