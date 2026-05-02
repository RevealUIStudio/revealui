'use client';

import type React from 'react';
import { type LinkBehavior, useLinkBehavior } from '../hooks/use-link-behavior.js';
import { cn } from '../utils/cn.js';
import { TouchTarget } from './button-headless.js';
import { type ButtonProps, buttonVariants } from './Button.js';

/**
 * LinkButton — a button-styled element that renders as an anchor by default,
 * with optional polymorphic override and provider-based routing-library wiring.
 *
 * Default usage: `<LinkButton href="/contact">Book a call</LinkButton>` renders
 * `<a href="/contact" class="…button…">Book a call</a>` — SSR-safe, zero deps.
 *
 * App-level wiring (recommended for SPAs):
 *   <LinkBehaviorProvider component={MyLink} hrefProp="to">
 *     <App />  // every <LinkButton href="/x"> downstream uses MyLink
 *   </LinkBehaviorProvider>
 *
 * Per-instance override (escape hatch):
 *   <LinkButton as={MyLink} to="/x">…</LinkButton>
 */
export interface LinkButtonOwnProps {
  /** URL the button navigates to. Required for normal usage; omit only when `as` provides its own URL prop. */
  href?: string;
  /** External link — adds `target="_blank" rel="noopener noreferrer"` and renders a native `<a>` regardless of provider. */
  external?: boolean;
  /** Button variant (matches `Button` / `buttonVariants`). */
  variant?: ButtonProps['variant'];
  /** Button size (matches `Button` / `buttonVariants`). */
  size?: ButtonProps['size'];
  /** Show a loading spinner and disable interaction. Sets `aria-busy="true"`. */
  isLoading?: boolean;
  /** Visually disabled + ARIA-disabled. Anchor's `href` is preserved (semantics unchanged); click is prevented and `tabIndex` set to -1. */
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export type LinkButtonProps<T extends React.ElementType = 'a'> = LinkButtonOwnProps & {
  /** Polymorphic override — render as a different component for this single instance. Drops the provider's `hrefProp` and uses `'href'` instead. */
  as?: T;
} & Omit<React.ComponentPropsWithoutRef<T>, keyof LinkButtonOwnProps | 'as' | 'ref'> & {
    ref?: React.Ref<Element>;
  };

function LoadingSpinner() {
  return (
    <svg
      className="mr-2 size-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

const sharedStyle: React.CSSProperties = {
  transition:
    'all var(--rvui-duration-normal, 200ms) var(--rvui-ease, cubic-bezier(0.22, 1, 0.36, 1))',
  borderRadius: 'var(--rvui-radius-md, 10px)',
};

function LinkButton<T extends React.ElementType = 'a'>({
  as,
  href,
  external = false,
  variant,
  size,
  isLoading = false,
  disabled = false,
  className,
  children,
  ref,
  ...rest
}: LinkButtonProps<T>) {
  const provided = useLinkBehavior();

  // External opts out of the provider Link entirely — always renders <a>.
  // Per-instance `as` override drops back to 'href' as the URL prop (since
  // the overriding component is unknown to the provider).
  const finalComponent: React.ElementType = external ? 'a' : (as ?? provided.component);
  const finalHrefProp = external || as ? 'href' : provided.hrefProp;

  const externalAttrs = external
    ? { target: '_blank' as const, rel: 'noopener noreferrer' as const }
    : null;

  const interactionLockClass = disabled || isLoading ? 'pointer-events-none' : '';
  const opacityClass = disabled ? 'opacity-50' : '';

  // `disabledAttrs` are applied AFTER `...rest` so they always win when the
  // consumer passes their own `onClick`/`tabIndex`. Disabled means disabled.
  const disabledAttrs = disabled
    ? {
        'aria-disabled': true as const,
        tabIndex: -1,
        onClick: (e: React.MouseEvent) => e.preventDefault(),
      }
    : null;

  const renderProps = {
    ...(href !== undefined ? { [finalHrefProp]: href } : {}),
    ...externalAttrs,
    'aria-busy': isLoading || undefined,
    className: cn(buttonVariants({ variant, size }), interactionLockClass, opacityClass, className),
    style: sharedStyle,
    ref,
    ...rest,
    ...disabledAttrs,
  };

  const Component = finalComponent as React.ElementType;
  return (
    <Component {...renderProps}>
      {isLoading ? <LoadingSpinner /> : null}
      <TouchTarget>{children}</TouchTarget>
    </Component>
  );
}

export { LinkButton };
export type { LinkBehavior };
