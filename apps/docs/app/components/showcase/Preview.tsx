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
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              theme === 'dark'
                ? 'bg-accent text-white'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Dark
          </button>
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              theme === 'light'
                ? 'bg-accent text-white'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Light
          </button>
        </div>
      </div>

      {/* Isolated preview area */}
      <div
        data-theme={theme}
        className="flex min-h-[200px] items-center justify-center p-8"
        style={{
          backgroundColor: theme === 'dark' ? 'oklch(0.13 0.004 228)' : 'oklch(0.985 0.002 210)',
          backgroundImage: 'radial-gradient(circle, oklch(0.5 0 0 / 0.06) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      >
        {children}
      </div>
    </div>
  );
}
