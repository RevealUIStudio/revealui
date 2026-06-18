interface CenteredCardGridProps {
  children: React.ReactNode;
  className?: string;
}

export function CenteredCardGrid({ children, className }: CenteredCardGridProps) {
  return (
    <div className={['flex flex-wrap justify-center gap-6', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}
