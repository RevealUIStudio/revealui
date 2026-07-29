import type React from 'react';
import { cn } from '../utils/cn.js';

export function Kbd({ className, children, ...props }: React.ComponentPropsWithoutRef<'kbd'>) {
  return (
    <kbd
      {...props}
      className={cn(
        'inline-flex items-center rounded border border-input bg-surface-2 px-1.5 py-0.5 font-mono text-xs font-medium text-body',
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export function KbdShortcut({
  keys,
  separator = '+',
  className,
}: {
  keys: string[];
  separator?: string;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {keys.map((key, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: keyboard shortcut keys are positionally ordered with no stable ID
        <span key={i} className="inline-flex items-center gap-1">
          <Kbd>{key}</Kbd>
          {i < keys.length - 1 && (
            <span className="text-xs text-muted-foreground">{separator}</span>
          )}
        </span>
      ))}
    </span>
  );
}
