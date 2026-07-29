import { cn } from '../utils/cn.js';

export function Divider({
  soft = false,
  className,
  ...props
}: { soft?: boolean } & React.ComponentPropsWithoutRef<'hr'>) {
  return (
    <hr
      {...props}
      className={cn(className, 'w-full border-t', soft ? 'border-border' : 'border-border-strong')}
    />
  );
}
