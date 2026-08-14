import { cn } from '../utils/cn.js';

export function DescriptionList({ className, ...props }: React.ComponentPropsWithoutRef<'dl'>) {
  return (
    <dl
      {...props}
      className={cn(
        className,
        'grid grid-cols-1 text-base/6 sm:grid-cols-[min(50%,--spacing(80))_auto] sm:text-sm/6',
      )}
    />
  );
}

export function DescriptionTerm({ className, ...props }: React.ComponentPropsWithoutRef<'dt'>) {
  return (
    <dt
      {...props}
      className={cn(
        className,
        'col-start-1 border-t border-border pt-3 text-muted-foreground first:border-none sm:border-t sm:border-border sm:py-3 sm:first:border-none',
      )}
    />
  );
}

export function DescriptionDetails({ className, ...props }: React.ComponentPropsWithoutRef<'dd'>) {
  return (
    <dd
      {...props}
      className={cn(
        className,
        'pt-1 pb-3 text-foreground sm:border-t sm:border-border sm:py-3 sm:nth-2:border-none',
      )}
    />
  );
}
