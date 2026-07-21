import { Button, GitHubIcon, IconChevronDown } from '@revealui/presentation';
import { useState } from 'react';
import { renderMarkdown } from '@/utils/markdown';
import { CodeView } from './CodeView.js';
import { Preview } from './Preview.js';
import { PropPanel } from './PropPanel.js';
import { showcaseEntries } from './registry.js';
import type { ShowcaseStory } from './types.js';
import { VariantGrid } from './VariantGrid.js';

type Tab = 'preview' | 'grid' | 'code';

interface ShowcaseShellProps {
  story: ShowcaseStory;
}

const REPO_BLOB_BASE = 'https://github.com/RevealUIStudio/revealui/blob/main/packages/presentation';

const DEFAULT_INSTALL = 'npm install @revealui/presentation';

export function ShowcaseShell({ story }: ShowcaseShellProps) {
  const [activeTab, setActiveTab] = useState<Tab>('preview');

  // Initialize prop values from control defaults
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const defaults: Record<string, unknown> = {};
    for (const [key, control] of Object.entries(story.controls)) {
      defaults[key] = control.default;
    }
    return defaults;
  });

  function handleChange(key: string, value: unknown) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'preview', label: 'Preview' },
    ...(story.variantGrid ? [{ id: 'grid' as Tab, label: 'Variants' }] : []),
    { id: 'code', label: 'Code' },
  ];

  const sourceHref = story.sourceUrl ? `${REPO_BLOB_BASE}/${story.sourceUrl}` : null;
  const installCmd = story.install ?? DEFAULT_INSTALL;
  const a11y = story.a11y;
  const hasA11y =
    !!a11y &&
    ((a11y.conformance?.length ?? 0) > 0 ||
      (a11y.keyboard && Object.keys(a11y.keyboard).length > 0) ||
      (a11y.aria && Object.keys(a11y.aria).length > 0) ||
      !!a11y.notes);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-8 py-10">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-ink">{story.name}</h1>
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
              {story.category}
            </span>
          </div>
          {sourceHref && (
            <a
              href={sourceHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-secondary no-underline transition-colors hover:text-ink"
            >
              <GitHubIcon className="h-3.5 w-3.5" />
              View source
            </a>
          )}
        </div>
        <p className="mt-1 text-sm text-text-secondary">{story.description}</p>
      </div>

      {/* Install command */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-2.5 font-mono text-xs">
        <span className="select-none text-text-muted">$</span>
        <span className="flex-1 text-ink">{installCmd}</span>
      </div>

      {/* Usage guidance */}
      {(story.usage?.when || story.usage?.avoid) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {story.usage.when && (
            <div className="rounded-xl border border-border bg-surface p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-success">
                When to use
              </h3>
              <div className="text-sm text-text-secondary">{renderMarkdown(story.usage.when)}</div>
            </div>
          )}
          {story.usage.avoid && (
            <div className="rounded-xl border border-border bg-surface p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-warning-foreground">
                When to avoid
              </h3>
              <div className="text-sm text-text-secondary">{renderMarkdown(story.usage.avoid)}</div>
            </div>
          )}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            type="button"
            appearance="ghost"
            variant={activeTab === tab.id ? 'brand' : 'neutral'}
            size="sm"
            onClick={() => setActiveTab(tab.id)}
            className={`h-auto rounded-none border-b-2 px-4 py-2 text-sm font-medium ${
              activeTab === tab.id
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'preview' && <Preview>{story.render(values)}</Preview>}
      {activeTab === 'grid' && <VariantGrid story={story} values={values} />}
      {activeTab === 'code' && <CodeView story={story} values={values} />}

      {/* Prop controls */}
      <PropPanel controls={story.controls} values={values} onChange={handleChange} />

      {/* Static examples */}
      {story.examples && story.examples.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-text-muted">
            Examples
          </h2>
          {story.examples.map((example) => (
            <div key={example.name} className="overflow-hidden rounded-xl border border-border">
              <div className="border-b border-border bg-surface px-4 py-2">
                <span className="text-xs font-medium text-text-secondary">{example.name}</span>
                {example.description && (
                  <span className="ml-2 text-xs text-text-muted">{example.description}</span>
                )}
              </div>
              <div
                className="flex items-center justify-center p-6"
                style={{
                  backgroundColor: 'oklch(0.13 0.004 228)',
                  backgroundImage:
                    'radial-gradient(circle, oklch(0.5 0 0 / 0.06) 1px, transparent 1px)',
                  backgroundSize: '20px 20px',
                }}
                data-theme="dark"
              >
                {example.render()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Accessibility */}
      {hasA11y && a11y && (
        <details className="group rounded-xl border border-border bg-surface" open>
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-ink">
            <span>Accessibility</span>
            <IconChevronDown
              size="sm"
              className="text-text-muted transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="space-y-4 border-t border-border px-4 py-4">
            {a11y.conformance && a11y.conformance.length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-muted">
                  Conformance
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {a11y.conformance.map((item) => (
                    <span
                      key={item}
                      className="rounded-md bg-success/15 px-2 py-1 text-xs font-medium text-success ring-1 ring-success/30"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {a11y.keyboard && Object.keys(a11y.keyboard).length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-muted">
                  Keyboard
                </h4>
                <dl className="divide-y divide-border text-sm">
                  {Object.entries(a11y.keyboard).map(([key, desc]) => (
                    <div key={key} className="flex gap-3 py-1.5">
                      <dt className="flex-shrink-0 font-mono text-xs text-ink">
                        <kbd className="rounded border border-border bg-bg px-1.5 py-0.5">
                          {key}
                        </kbd>
                      </dt>
                      <dd className="text-text-secondary">{desc}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            {a11y.aria && Object.keys(a11y.aria).length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-muted">
                  ARIA
                </h4>
                <dl className="divide-y divide-border text-sm">
                  {Object.entries(a11y.aria).map(([attr, desc]) => (
                    <div key={attr} className="flex gap-3 py-1.5">
                      <dt className="flex-shrink-0 font-mono text-xs text-ink">{attr}</dt>
                      <dd className="text-text-secondary">{desc}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            {a11y.notes && (
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-muted">
                  Notes
                </h4>
                <div className="text-sm text-text-secondary">{renderMarkdown(a11y.notes)}</div>
              </div>
            )}
          </div>
        </details>
      )}

      {/* Related */}
      {story.related && story.related.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-text-muted">
            See also
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {story.related.map((rel) => {
              const target = showcaseEntries.find((e) => e.slug === rel.slug);
              const label = target?.name ?? rel.slug;
              return (
                <a
                  key={rel.slug}
                  href={`/showcase/${rel.slug}`}
                  className="rounded-xl border border-border bg-surface px-4 py-3 no-underline transition-colors hover:border-accent"
                >
                  <div className="text-sm font-semibold text-ink">{label}</div>
                  {rel.reason && (
                    <div className="mt-1 text-xs text-text-secondary">{rel.reason}</div>
                  )}
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
