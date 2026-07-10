import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as Ui from '../../../../packages/presentation/dist/index.js';
import * as SourceComponents from '../../../../packages/presentation/src/components/index.js';
import type { CuratedEntry, PreviewSection } from './registry.js';
import { escapeComment, escapeHtml, isPascalCase, kebabCase } from './util.js';

const CARD_GROUP = 'Components (from code)';

function isComponentExport(name: string, value: unknown): boolean {
  const isFn = typeof value === 'function';
  const isExotic = typeof value === 'object' && value !== null && '$$typeof' in (value as object);
  return (isFn || isExotic) && isPascalCase(name) && !name.startsWith('use');
}

/**
 * Authoritative component surface: the source component barrel's exports,
 * filtered to renderable components and sorted for deterministic output.
 */
export function listComponentNames(): string[] {
  const source = SourceComponents as Record<string, unknown>;
  return Object.keys(source)
    .filter((name) => isComponentExport(name, source[name]))
    .sort((a, b) => a.localeCompare(b, 'en'));
}

/** Render a React node to static markup, or null if it throws or is empty. */
function renderNodeSafe(node: React.ReactNode): string | null {
  try {
    const html = renderToStaticMarkup(React.createElement(React.Fragment, null, node));
    return html.length > 0 ? html : null;
  } catch {
    return null;
  }
}

/** Render curated sections, dropping any that fail to render statically. */
function renderCuratedSections(sections: PreviewSection[]): string[] {
  const out: string[] = [];
  for (const section of sections) {
    const markup = renderNodeSafe(section.node);
    if (markup) out.push(sectionHtml(section.label, markup));
  }
  return out;
}

/**
 * Default harness for components without a curated example. Tries a no-children
 * render first (void elements like input/hr break with children), then a
 * with-children render.
 */
function renderDefaultHarness(name: string): { sections: string[]; subtitle: string } {
  const Component = (Ui as Record<string, React.ComponentType<Record<string, unknown>>>)[name];
  if (!Component) {
    return { sections: [], subtitle: 'No preview' };
  }
  const attempts: React.ReactNode[] = [
    React.createElement(Component, {}),
    React.createElement(Component, {}, 'Sample'),
  ];
  for (const node of attempts) {
    const markup = renderNodeSafe(node);
    if (markup) {
      return { sections: [sectionHtml('Default', markup)], subtitle: 'Default preview' };
    }
  }
  return { sections: [], subtitle: 'No standalone preview' };
}

function sectionHtml(label: string, markup: string): string {
  return `<section class="dsc-section">
      <div class="dsc-section-label">${escapeHtml(label)}</div>
      <div class="dsc-canvas">${markup}</div>
    </section>`;
}

const STUB_NOTE =
  'This component requires a parent context or composition and has no standalone static preview. See the composed components for its rendered form.';

export interface ComponentRenderResult {
  name: string;
  fileName: string;
  subtitle: string;
  status: 'curated' | 'default' | 'stub';
  html: string;
}

/** Build the full HTML page for a single component. */
export function renderComponentPage(
  name: string,
  curated: CuratedEntry | undefined,
): ComponentRenderResult {
  let sections: string[] = [];
  let subtitle: string;
  let status: ComponentRenderResult['status'];

  if (curated) {
    sections = renderCuratedSections(curated.sections);
    subtitle = curated.subtitle;
    status = sections.length > 0 ? 'curated' : 'stub';
  } else {
    const harness = renderDefaultHarness(name);
    sections = harness.sections;
    subtitle = harness.subtitle;
    status = sections.length > 0 ? 'default' : 'stub';
  }

  if (sections.length === 0) {
    sections = [`<section class="dsc-section"><p class="dsc-stub">${STUB_NOTE}</p></section>`];
  }

  const html = pageHtml({ name, subtitle, body: sections.join('\n    ') });
  return { name, fileName: `${kebabCase(name)}.html`, subtitle, status, html };
}

interface PageHtmlInput {
  name: string;
  subtitle: string;
  body: string;
}

function dsCard(name: string, subtitle: string): string {
  return `<!-- @dsCard group="${escapeComment(CARD_GROUP)}" name="${escapeComment(name)}" subtitle="${escapeComment(subtitle)}" -->`;
}

function pageHtml({ name, subtitle, body }: PageHtmlInput): string {
  return `${dsCard(name, subtitle)}
<link rel="stylesheet" href="../_preview.css" />
<style>${PAGE_STYLE}</style>
<div class="dsc-root" data-theme="dark">
  <header class="dsc-header">
    <div>
      <h1 class="dsc-title">${escapeHtml(name)}</h1>
      <p class="dsc-subtitle">${escapeHtml(subtitle)}</p>
    </div>
    <div class="dsc-theme-toggle" role="group" aria-label="Theme">
      <button type="button" class="dsc-theme-btn is-active" data-theme-set="dark">Dark</button>
      <button type="button" class="dsc-theme-btn" data-theme-set="light">Light</button>
    </div>
  </header>
  <main class="dsc-sections">
    ${body}
  </main>
</div>
<script>${TOGGLE_SCRIPT}</script>
`;
}

/** Catalog index page linking every component preview. */
export function renderCatalogPage(results: ComponentRenderResult[]): string {
  const rows = results
    .map(
      (r) =>
        `      <li class="dsc-cat-item"><a class="dsc-cat-link" href="components/${r.fileName}"><span class="dsc-cat-name">${escapeHtml(r.name)}</span><span class="dsc-cat-sub">${escapeHtml(r.subtitle)}</span></a></li>`,
    )
    .join('\n');
  return `${dsCard('Component Catalog', `${results.length} components generated from @revealui/presentation`)}
<link rel="stylesheet" href="_preview.css" />
<style>${PAGE_STYLE}</style>
<div class="dsc-root" data-theme="dark">
  <header class="dsc-header">
    <div>
      <h1 class="dsc-title">Component Catalog</h1>
      <p class="dsc-subtitle">${results.length} components generated from @revealui/presentation</p>
    </div>
  </header>
  <main class="dsc-sections">
    <ul class="dsc-catalog">
${rows}
    </ul>
  </main>
</div>
`;
}

const TOGGLE_SCRIPT = `
(function () {
  var root = document.currentScript.previousElementSibling;
  if (!root) return;
  root.querySelectorAll('.dsc-theme-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var mode = btn.getAttribute('data-theme-set');
      root.setAttribute('data-theme', mode);
      root.querySelectorAll('.dsc-theme-btn').forEach(function (b) {
        b.classList.toggle('is-active', b === btn);
      });
    });
  });
})();
`.trim();

const PAGE_STYLE = `
.dsc-root { min-height: 100vh; background: var(--rvui-surface-0); color: var(--rvui-text-0); font-family: var(--rvui-font-sans, ui-sans-serif, system-ui, sans-serif); padding: 24px; box-sizing: border-box; }
.dsc-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
.dsc-title { font-size: 20px; font-weight: 700; margin: 0; }
.dsc-subtitle { font-size: 13px; color: var(--rvui-text-2); margin: 4px 0 0; }
.dsc-theme-toggle { display: inline-flex; gap: 2px; padding: 2px; border-radius: 8px; background: var(--rvui-surface-2); }
.dsc-theme-btn { border: 0; cursor: pointer; padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 500; color: var(--rvui-text-2); background: transparent; }
.dsc-theme-btn.is-active { background: var(--rvui-brand); color: var(--rvui-text-on-brand, #fff); }
.dsc-sections { display: flex; flex-direction: column; gap: 20px; max-width: 100%; }
.dsc-section { border: 1px solid var(--rvui-border); border-radius: 12px; overflow: hidden; }
.dsc-section-label { font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--rvui-text-2); padding: 8px 16px; border-bottom: 1px solid var(--rvui-border); background: var(--rvui-surface-1); }
.dsc-canvas { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; padding: 28px; background: var(--rvui-surface-0); overflow-x: auto; }
.dsc-stub { padding: 20px 16px; margin: 0; font-size: 13px; color: var(--rvui-text-2); }
.dsc-body-text { font-size: 14px; color: var(--rvui-text-1); margin: 0; }
.dsc-variant-row { display: flex; flex-wrap: wrap; gap: 20px; }
.dsc-variant-cell { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.dsc-variant-tag { font-size: 10px; font-family: var(--rvui-font-mono, ui-monospace, monospace); color: var(--rvui-text-2); }
.dsc-variant-matrix { border-collapse: collapse; }
.dsc-variant-th { font-size: 10px; font-family: var(--rvui-font-mono, ui-monospace, monospace); color: var(--rvui-text-2); padding: 8px 12px; text-align: left; border: 1px solid var(--rvui-border); background: var(--rvui-surface-1); }
.dsc-variant-td { padding: 16px; text-align: center; border: 1px solid var(--rvui-border); }
.dsc-dialog-panel { width: 100%; max-width: 420px; padding: 28px; border-radius: 16px; background: var(--rvui-surface-1); box-shadow: var(--rvui-shadow-lg, 0 12px 40px rgba(0,0,0,0.35)); border: 1px solid var(--rvui-border-subtle, var(--rvui-border)); }
.dsc-drawer-panel { width: 100%; max-width: 360px; padding: 20px; border-radius: 12px; background: var(--rvui-surface-1); border: 1px solid var(--rvui-border); box-shadow: var(--rvui-shadow-lg, 0 12px 40px rgba(0,0,0,0.35)); }
.dsc-tooltip-demo { position: relative; display: inline-flex; padding-top: 44px; }
.dsc-tooltip-bubble { position: absolute; top: 0; left: 50%; transform: translateX(-50%); background: var(--rvui-surface-3, #333); color: var(--rvui-text-0); font-size: 12px; padding: 6px 10px; border-radius: 6px; white-space: nowrap; box-shadow: var(--rvui-shadow-md, 0 6px 20px rgba(0,0,0,0.3)); }
.dsc-toast-stack { display: flex; flex-direction: column; gap: 10px; width: 100%; max-width: 360px; }
.dsc-toast { display: flex; gap: 10px; padding: 12px 14px; border-radius: 10px; background: var(--rvui-surface-1); border: 1px solid var(--rvui-border); }
.dsc-toast-success { border-color: var(--rvui-success, #16a34a); }
.dsc-toast-error { border-color: var(--rvui-error, #dc2626); }
.dsc-toast-icon { font-weight: 700; }
.dsc-toast-title { font-size: 13px; font-weight: 600; margin: 0; color: var(--rvui-text-0); }
.dsc-toast-desc { font-size: 12px; margin: 2px 0 0; color: var(--rvui-text-2); }
.dsc-catalog { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
.dsc-cat-item { margin: 0; }
.dsc-cat-link { display: flex; flex-direction: column; gap: 2px; padding: 12px 14px; border: 1px solid var(--rvui-border); border-radius: 10px; text-decoration: none; background: var(--rvui-surface-1); }
.dsc-cat-name { font-size: 14px; font-weight: 600; color: var(--rvui-text-0); }
.dsc-cat-sub { font-size: 11px; color: var(--rvui-text-2); }
`.trim();
