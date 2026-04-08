'use client';

import { type ComponentProps, type ReactNode, useCallback, useRef, useState } from 'react';
import { CheckmarkIcon } from '@/components/revealui/icons/checkmark-icon';
import { Squares2StackedIcon } from '@/components/revealui/icons/squares-2-stacked-icon';
import { cn } from '@/lib/utils/cn';

export function InstallCommand({
  snippet,
  variant = 'normal',
  className,
  ...props
}: {
  snippet: ReactNode;
  variant?: 'normal' | 'overlay';
} & ComponentProps<'div'>) {
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLSpanElement>(null);

  const handleCopy = useCallback(() => {
    const text = contentRef.current?.textContent;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-6 rounded-full p-1 font-mono text-sm/7 inset-ring-1 dark:bg-white/10 dark:inset-ring-white/10',
        variant === 'normal' && 'bg-white text-mist-600 inset-ring-black/10 dark:text-white',
        variant === 'overlay' && 'bg-white/15 text-white inset-ring-white/10',
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-2 pl-3">
        <div className="text-current/60 select-none">$</div>
        <span ref={contentRef}>{snippet}</span>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="group relative flex size-9 items-center justify-center rounded-full after:absolute after:-inset-1 hover:bg-mist-950/10 dark:hover:bg-white/10 after:pointer-fine:hidden"
      >
        {copied ? <CheckmarkIcon /> : <Squares2StackedIcon />}
      </button>
    </div>
  );
}
