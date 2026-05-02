'use client';

import { createContext, type ElementType, type ReactNode, useContext, useMemo } from 'react';

/**
 * Configures how `LinkButton` (and other anchor-rendering primitives) wire up
 * client-side navigation. By default they render a native `<a href>`.
 * Apps that have their own Link component (e.g. `@revealui/router`'s `Link`,
 * Next.js `next/link`, react-router's `Link`) can wrap their tree in
 * `<LinkBehaviorProvider component={MyLink} hrefProp="to">…</LinkBehaviorProvider>`
 * once at the root, and every downstream `LinkButton` will route via that
 * Link without per-instance wiring.
 */
export interface LinkBehavior {
  /** Component to render for non-external links. Defaults to native `'a'`. */
  component: ElementType;
  /**
   * Name of the prop on `component` that takes the URL.
   * `'href'` for native `<a>` and Next.js `next/link`;
   * `'to'` for `@revealui/router` and react-router's `Link`.
   * Defaults to `'href'`.
   */
  hrefProp: string;
}

const defaultBehavior: LinkBehavior = { component: 'a', hrefProp: 'href' };

const LinkBehaviorContext = createContext<LinkBehavior>(defaultBehavior);

export interface LinkBehaviorProviderProps extends Partial<LinkBehavior> {
  children: ReactNode;
}

export function LinkBehaviorProvider({
  component,
  hrefProp = 'href',
  children,
}: LinkBehaviorProviderProps) {
  const value = useMemo<LinkBehavior>(
    () => ({ component: component ?? 'a', hrefProp }),
    [component, hrefProp],
  );
  return <LinkBehaviorContext.Provider value={value}>{children}</LinkBehaviorContext.Provider>;
}

export function useLinkBehavior(): LinkBehavior {
  return useContext(LinkBehaviorContext);
}
