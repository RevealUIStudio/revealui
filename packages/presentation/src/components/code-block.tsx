'use client';

import { useCallback, useState } from 'react';
import { cn } from '../utils/cn.js';

export function CodeBlock({
  code,
  language,
  filename,
  showCopy = true,
  className,
}: {
  code: string;
  language?: string;
  filename?: string;
  showCopy?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div className={cn('overflow-hidden rounded-xl bg-surface-0 ring-1 ring-border', className)}>
      {(filename || language || showCopy) && (
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-2">
            {filename && <span className="text-xs text-muted-foreground">{filename}</span>}
            {language && !filename && (
              <span className="rounded bg-surface-3 px-1.5 py-0.5 text-xs text-muted-foreground">
                {language}
              </span>
            )}
          </div>
          {showCopy && (
            <button
              type="button"
              onClick={() => void handleCopy()}
              aria-label={copied ? 'Copied' : 'Copy code'}
              className="rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          )}
        </div>
      )}
      <pre className="overflow-x-auto p-4 text-sm leading-relaxed text-muted-foreground">
        <code>{code}</code>
      </pre>
    </div>
  );
}
