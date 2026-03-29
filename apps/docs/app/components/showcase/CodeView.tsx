import { useState } from 'react';
import type { ShowcaseStory } from './types.js';

interface CodeViewProps {
  story: ShowcaseStory;
  values: Record<string, unknown>;
}

/** Generate JSX code string from component name and current prop values */
function generateCode(story: ShowcaseStory, values: Record<string, unknown>): string {
  if (story.code) return story.code(values);

  const attrs: string[] = [];
  for (const [key, control] of Object.entries(story.controls)) {
    const val = values[key];
    if (val === control.default) continue;

    if (control.type === 'boolean') {
      if (val) attrs.push(key);
    } else if (control.type === 'number' || control.type === 'range') {
      attrs.push(`${key}={${val}}`);
    } else if (key === 'children') {
    } else {
      attrs.push(`${key}="${val}"`);
    }
  }

  const attrStr = attrs.length > 0 ? ` ${attrs.join(' ')}` : '';
  const children = values.children as string | undefined;

  if (children) {
    return `<${story.name}${attrStr}>${children}</${story.name}>`;
  }
  return `<${story.name}${attrStr} />`;
}

export function CodeView({ story, values }: CodeViewProps) {
  const [copied, setCopied] = useState(false);
  const code = generateCode(story, values);

  function handleCopy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-border">
      <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-2">
        <span className="text-xs font-medium text-text-muted">Code</span>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-md px-2 py-1 text-xs text-text-muted transition-colors hover:text-accent"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-sm leading-relaxed">
        <code className="font-mono text-text-secondary">{code}</code>
      </pre>
    </div>
  );
}
