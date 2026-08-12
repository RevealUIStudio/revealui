import { cn } from '../utils/cn.js';
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
