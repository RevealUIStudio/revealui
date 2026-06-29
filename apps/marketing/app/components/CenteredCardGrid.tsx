import { cn } from '@revealui/presentation';

interface CenteredCardGridProps {
  children: React.ReactNode;
  className?: string;
}

export function CenteredCardGrid({ children, className }: CenteredCardGridProps) {
  return <div className={cn('flex flex-wrap justify-center gap-6', className)}>{children}</div>;
}
