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
    <div className={cn('overflow-hidden rounded-xl bg-zinc-950 ring-1 ring-zinc-800', className)}>
      {(filename || language || showCopy) && (
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
          <div className="flex items-center gap-2">
            {filename && <span className="text-xs text-zinc-400">{filename}</span>}
            {language && !filename && (
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400">
                {language}
              </span>
            )}
          </div>
          {showCopy && (
            <button
              type="button"
              onClick={() => void handleCopy()}
              aria-label={copied ? 'Copied' : 'Copy code'}
              className="rounded px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          )}
        </div>
      )}
      <pre className="overflow-x-auto p-4 text-sm leading-relaxed text-zinc-300">
        <code>{code}</code>
      </pre>
    </div>
  );
}
