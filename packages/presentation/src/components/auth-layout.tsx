import type React from 'react';

export interface AuthLayoutProps {
  children: React.ReactNode;
  /** Optional branding slot rendered above the auth form */
  header?: React.ReactNode;
  /** Optional branding slot rendered below the auth form */
  footer?: React.ReactNode;
}

export function AuthLayout({ children, header, footer }: AuthLayoutProps) {
  return (
    <main className="flex min-h-dvh flex-col p-2">
      <div className="flex grow flex-col items-center justify-center gap-6 p-6 lg:rounded-lg lg:bg-white lg:p-10 lg:shadow-xs lg:ring-1 lg:ring-zinc-950/5 dark:lg:bg-zinc-900 dark:lg:ring-white/10">
        {header}
        {children}
        {footer}
      </div>
    </main>
  );
}
