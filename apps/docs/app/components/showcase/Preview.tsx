import { Button } from '@revealui/presentation';
import { useState } from 'react';

interface PreviewProps {
  children: React.ReactNode;
}

export function Preview({ children }: PreviewProps) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-2">
        <span className="text-xs font-medium text-text-muted">Preview</span>
        <div className="flex gap-1 rounded-lg bg-surface p-0.5">
          <Button
            type="button"
            appearance={theme === 'dark' ? 'solid' : 'ghost'}
            variant={theme === 'dark' ? 'brand' : 'neutral'}
            size="sm"
            onClick={() => setTheme('dark')}
            className="h-auto px-2.5 py-1 text-xs"
          >
            Dark
          </Button>
          <Button
            type="button"
            appearance={theme === 'light' ? 'solid' : 'ghost'}
            variant={theme === 'light' ? 'brand' : 'neutral'}
            size="sm"
            onClick={() => setTheme('light')}
            className="h-auto px-2.5 py-1 text-xs"
          >
            Light
          </Button>
        </div>
      </div>

      {/* Isolated preview area — data-showcase-preview scopes axe scans to the
          component under test (see e2e/showcase-a11y.e2e.ts), not docs chrome. */}
      <div
        data-showcase-preview
        data-theme={theme}
        className="flex min-h-[200px] items-center justify-center p-8"
        style={{
          // Nested data-theme must re-apply palette (see tokens.css :root, [data-theme=dark])
          backgroundColor: 'var(--rvui-surface-0)',
          backgroundImage: 'radial-gradient(circle, oklch(0.5 0 0 / 0.06) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      >
        {children}
      </div>
    </div>
  );
}
