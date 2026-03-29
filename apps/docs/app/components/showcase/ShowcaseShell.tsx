import { useState } from 'react';
import { CodeView } from './CodeView.js';
import { Preview } from './Preview.js';
import { PropPanel } from './PropPanel.js';
import type { ShowcaseStory } from './types.js';
import { VariantGrid } from './VariantGrid.js';

type Tab = 'preview' | 'grid' | 'code';

interface ShowcaseShellProps {
  story: ShowcaseStory;
}

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

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-8 py-10">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-ink">{story.name}</h1>
          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
            {story.category}
          </span>
        </div>
        <p className="mt-1 text-sm text-text-secondary">{story.description}</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab.label}
          </button>
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
    </div>
  );
}
