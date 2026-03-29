import { useState } from 'react';

interface TokenGroup {
  title: string;
  tokens: Array<{ name: string; description?: string }>;
}

const colorTokens: TokenGroup[] = [
  {
    title: 'Brand',
    tokens: [
      { name: '--rvui-brand', description: 'Primary brand accent' },
      { name: '--rvui-brand-subtle', description: 'Subtle brand tint' },
      { name: '--rvui-brand-strong', description: 'Stronger brand shade' },
      { name: '--rvui-brand-text', description: 'Text on brand backgrounds' },
    ],
  },
  {
    title: 'Surfaces',
    tokens: [
      { name: '--rvui-surface-0', description: 'Page background' },
      { name: '--rvui-surface-1', description: 'Card / panel' },
      { name: '--rvui-surface-2', description: 'Elevated surface' },
      { name: '--rvui-surface-3', description: 'Highest elevation' },
    ],
  },
  {
    title: 'Borders',
    tokens: [
      { name: '--rvui-border', description: 'Default border' },
      { name: '--rvui-border-subtle', description: 'Subtle divider' },
      { name: '--rvui-border-strong', description: 'Emphasis border' },
    ],
  },
  {
    title: 'Text',
    tokens: [
      { name: '--rvui-text-0', description: 'Primary text' },
      { name: '--rvui-text-1', description: 'Secondary text' },
      { name: '--rvui-text-2', description: 'Tertiary / muted text' },
    ],
  },
  {
    title: 'Status',
    tokens: [
      { name: '--rvui-success', description: 'Success state' },
      { name: '--rvui-success-subtle', description: 'Success background' },
      { name: '--rvui-warning', description: 'Warning state' },
      { name: '--rvui-warning-subtle', description: 'Warning background' },
      { name: '--rvui-error', description: 'Error state' },
      { name: '--rvui-error-subtle', description: 'Error background' },
      { name: '--rvui-info', description: 'Info state' },
      { name: '--rvui-info-subtle', description: 'Info background' },
    ],
  },
];

const shapeTokens = [
  { name: '--rvui-radius-sm', label: 'sm', size: '6px' },
  { name: '--rvui-radius-md', label: 'md', size: '10px' },
  { name: '--rvui-radius-lg', label: 'lg', size: '16px' },
  { name: '--rvui-radius-xl', label: 'xl', size: '24px' },
  { name: '--rvui-radius-full', label: 'full', size: '9999px' },
];

const spacingTokens = [
  { name: '--rvui-space-1', label: '1', px: '4px' },
  { name: '--rvui-space-2', label: '2', px: '8px' },
  { name: '--rvui-space-3', label: '3', px: '12px' },
  { name: '--rvui-space-4', label: '4', px: '16px' },
  { name: '--rvui-space-6', label: '6', px: '24px' },
  { name: '--rvui-space-8', label: '8', px: '32px' },
  { name: '--rvui-space-12', label: '12', px: '48px' },
  { name: '--rvui-space-16', label: '16', px: '64px' },
  { name: '--rvui-space-24', label: '24', px: '96px' },
];

const typographyTokens = [
  { name: '--rvui-text-xs', label: 'xs', size: '0.75rem' },
  { name: '--rvui-text-sm', label: 'sm', size: '0.875rem' },
  { name: '--rvui-text-base', label: 'base', size: '1rem' },
  { name: '--rvui-text-lg', label: 'lg', size: '1.125rem' },
  { name: '--rvui-text-xl', label: 'xl', size: '1.25rem' },
  { name: '--rvui-text-2xl', label: '2xl', size: '1.5rem' },
  { name: '--rvui-text-3xl', label: '3xl', size: '1.875rem' },
  { name: '--rvui-text-display', label: 'display', size: '2.5rem' },
];

const shadowTokens = [
  { name: '--rvui-shadow-sm', label: 'sm' },
  { name: '--rvui-shadow-md', label: 'md' },
  { name: '--rvui-shadow-lg', label: 'lg' },
  { name: '--rvui-shadow-glow', label: 'glow' },
];

function ColorSwatch({ name, description }: { name: string; description?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="size-10 shrink-0 rounded-lg border border-white/10"
        style={{ backgroundColor: `var(${name})` }}
      />
      <div className="min-w-0">
        <p className="truncate font-mono text-xs text-text-secondary">{name}</p>
        {description && <p className="text-[10px] text-text-muted">{description}</p>}
      </div>
    </div>
  );
}

export function TokensPage() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-8 py-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Design Tokens</h1>
        <p className="mt-2 text-sm text-text-secondary">
          RevealUI's design language encoded as CSS custom properties. OKLCH color space,
          dark-first, all in the <code className="font-mono text-accent">--rvui-*</code> namespace.
        </p>
      </div>

      {/* Theme toggle */}
      <div className="flex gap-1 rounded-lg border border-border p-0.5 w-fit">
        <button
          type="button"
          onClick={() => setTheme('dark')}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            theme === 'dark' ? 'bg-accent text-white' : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          Dark
        </button>
        <button
          type="button"
          onClick={() => setTheme('light')}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            theme === 'light' ? 'bg-accent text-white' : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          Light
        </button>
      </div>

      {/* Color Tokens */}
      <div
        data-theme={theme}
        className="rounded-2xl border border-border p-6"
        style={{
          backgroundColor: theme === 'dark' ? 'oklch(0.13 0.004 228)' : 'oklch(0.985 0.002 210)',
        }}
      >
        <h2 className="mb-6 text-lg font-semibold" style={{ color: 'var(--rvui-text-0)' }}>
          Colors
        </h2>
        <div className="space-y-8">
          {colorTokens.map((group) => (
            <div key={group.title}>
              <h3
                className="mb-3 text-xs font-semibold uppercase tracking-widest"
                style={{ color: 'var(--rvui-text-2)' }}
              >
                {group.title}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {group.tokens.map((token) => (
                  <ColorSwatch key={token.name} {...token} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Shape / Radius */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-ink">Border Radius</h2>
        <div className="flex flex-wrap items-end gap-4">
          {shapeTokens.map((token) => (
            <div key={token.name} className="flex flex-col items-center gap-2">
              <div
                className="size-16 border-2 border-accent bg-accent/10"
                style={{ borderRadius: `var(${token.name})` }}
              />
              <span className="font-mono text-[10px] text-text-muted">{token.label}</span>
              <span className="text-[10px] text-text-muted">{token.size}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Spacing */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-ink">Spacing Scale</h2>
        <div className="space-y-2">
          {spacingTokens.map((token) => (
            <div key={token.name} className="flex items-center gap-3">
              <span className="w-8 text-right font-mono text-[10px] text-text-muted">
                {token.label}
              </span>
              <div
                className="h-4 rounded-sm bg-accent/60"
                style={{ width: `var(${token.name})` }}
              />
              <span className="font-mono text-[10px] text-text-muted">{token.px}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Typography Scale */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-ink">Typography Scale</h2>
        <div className="space-y-3">
          {typographyTokens.map((token) => (
            <div key={token.name} className="flex items-baseline gap-3">
              <span className="w-16 shrink-0 text-right font-mono text-[10px] text-text-muted">
                {token.label}
              </span>
              <span className="text-text-secondary" style={{ fontSize: `var(${token.name})` }}>
                The quick brown fox
              </span>
              <span className="font-mono text-[10px] text-text-muted">{token.size}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Shadows */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-ink">Shadows</h2>
        <div
          data-theme={theme}
          className="flex flex-wrap gap-6 rounded-2xl p-8"
          style={{
            backgroundColor: theme === 'dark' ? 'oklch(0.13 0.004 228)' : 'oklch(0.985 0.002 210)',
          }}
        >
          {shadowTokens.map((token) => (
            <div key={token.name} className="flex flex-col items-center gap-2">
              <div
                className="size-20 rounded-xl"
                style={{
                  backgroundColor: 'var(--rvui-surface-1)',
                  boxShadow: `var(${token.name})`,
                }}
              />
              <span className="font-mono text-[10px]" style={{ color: 'var(--rvui-text-2)' }}>
                {token.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
