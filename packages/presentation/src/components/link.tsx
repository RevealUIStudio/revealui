/**
 * Link component - Framework-agnostic link component
 *
 * This is a generic Link component that works with any framework.
 * For framework-specific implementations:
 * - Next.js: Use Next.js Link component (see apps/admin/src/lib/components/Link)
 * - Other frameworks: Wrap this component with your framework's Link
 */

import type React from 'react';
import { useDataInteractive } from '../hooks/use-data-interactive.js';

export function Link({
  ref,
  ...props
}: { href: string; ref?: React.Ref<HTMLAnchorElement> } & React.ComponentPropsWithoutRef<'a'>) {
  const interactiveProps = useDataInteractive();

  return <a {...props} {...interactiveProps} ref={ref} />;
}
