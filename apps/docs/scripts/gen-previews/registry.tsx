/**
 * Curated example registry — the single module that maps a component export
 * name to preview sections, seeded from the docs-app showcase stories
 * (extend-before-create: the showcase already owns curated example content).
 *
 * Two overrides on top of the showcase reuse:
 *  - alias map: showcases keyed by concept-slug fan out to the styled + headless
 *    export pairs (e.g. `button` → Button and ButtonCVA).
 *  - overlay snapshots: Dialog/Drawer/Tooltip/Toast portal to document.body or
 *    render from client state, so `renderToStaticMarkup` can never capture their
 *    open state. Those four get a hand-composed representative snapshot built
 *    from the real exported sub-parts.
 *
 * A component with no curated entry is not dropped — render.tsx falls back to a
 * default harness. Adding a component to @revealui/presentation therefore needs
 * zero edits here to appear in the output.
 */
import * as React from 'react';
import * as Ui from '../../../../packages/presentation/dist/index.js';
import { showcaseEntries } from '../../app/components/showcase/registry.js';
import type { ShowcaseStory } from '../../app/components/showcase/types.js';

export interface PreviewSection {
  label: string;
  node: React.ReactNode;
}

export interface CuratedEntry {
  subtitle: string;
  sections: PreviewSection[];
}

/** Showcase slugs that are not components on the presentation component surface. */
const SKIP_SLUGS = new Set(['animations', 'theme', 'icons']);

/** Concept-slug → the component export name(s) that story represents. */
const SLUG_ALIASES: Record<string, string[]> = {
  button: ['Button', 'ButtonCVA'],
  checkbox: ['Checkbox', 'CheckboxCVA'],
  input: ['Input', 'InputCVA'],
  select: ['Select', 'SelectCVA'],
  textarea: ['Textarea', 'TextareaCVA'],
  linkbutton: ['LinkButton'],
  toast: ['ToastProvider'],
};

function kebabToPascal(slug: string): string {
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function pluralize(word: string): string {
  return word.endsWith('s') ? word : `${word}s`;
}

/**
 * Wrapper so a showcase render function runs INSIDE React's render pass. Some
 * examples call hooks (useState) at the top of their render fn; invoking them
 * eagerly outside a component triggers "Invalid hook call".
 */
function Lazy({ render }: { render: () => React.ReactNode }): React.ReactNode {
  return <>{render()}</>;
}

function lazyNode(render: () => React.ReactNode): React.ReactNode {
  return <Lazy render={render} />;
}

function controlDefaults(story: ShowcaseStory): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, control] of Object.entries(story.controls)) {
    out[key] = control.default;
  }
  return out;
}

function storySubtitle(story: ShowcaseStory): string {
  if (story.variantGrid) {
    return Object.entries(story.variantGrid)
      .map(([axis, values]) => `${values.length} ${pluralize(axis)}`)
      .join(', ');
  }
  const count = story.examples?.length ?? 0;
  if (count > 0) return `${count} example${count === 1 ? '' : 's'}`;
  const firstSentence = story.description.split('.')[0]?.trim() ?? '';
  return firstSentence.length > 64 ? `${firstSentence.slice(0, 61)}...` : firstSentence;
}

function variantMatrixNode(
  story: ShowcaseStory,
  defaults: Record<string, unknown>,
): React.ReactNode {
  const axes = Object.entries(story.variantGrid ?? {});
  if (axes.length === 1) {
    const [prop, values] = axes[0] as [string, string[]];
    return (
      <div className="dsc-variant-row">
        {values.map((value) => (
          <div className="dsc-variant-cell" key={value}>
            <div className="dsc-variant-preview">
              {lazyNode(() => story.render({ ...defaults, [prop]: value }))}
            </div>
            <span className="dsc-variant-tag">{value}</span>
          </div>
        ))}
      </div>
    );
  }
  const [rowProp, rowValues] = axes[0] as [string, string[]];
  const [colProp, colValues] = axes[1] as [string, string[]];
  return (
    <table className="dsc-variant-matrix">
      <thead>
        <tr>
          <th className="dsc-variant-th">
            {rowProp} \ {colProp}
          </th>
          {colValues.map((col) => (
            <th className="dsc-variant-th" key={col}>
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rowValues.map((row) => (
          <tr key={row}>
            <td className="dsc-variant-th">{row}</td>
            {colValues.map((col) => (
              <td className="dsc-variant-td" key={col}>
                {lazyNode(() => story.render({ ...defaults, [rowProp]: row, [colProp]: col }))}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function sectionsFromStory(story: ShowcaseStory): PreviewSection[] {
  const defaults = controlDefaults(story);
  const sections: PreviewSection[] = [];
  if (story.variantGrid) {
    sections.push({ label: 'Variants', node: variantMatrixNode(story, defaults) });
  } else {
    sections.push({ label: 'Default', node: lazyNode(() => story.render(defaults)) });
  }
  for (const example of story.examples ?? []) {
    sections.push({ label: example.name, node: lazyNode(() => example.render()) });
  }
  return sections;
}

const noop = (): void => undefined;

/**
 * Authored static snapshots for components the showcase reuse cannot cover:
 *  - Dialog/Drawer/Tooltip/Toast portal to document.body or render from client
 *    state, so their open state cannot be captured by static server rendering;
 *    composed here from the real exported sub-parts.
 *  - PricingTable has required props and no showcase story.
 */
function authoredSnapshots(): Record<string, CuratedEntry> {
  const {
    DialogTitle,
    DialogDescription,
    DialogBody,
    DialogActions,
    ButtonCVA,
    DrawerHeader,
    DrawerBody,
    DrawerFooter,
    PricingTable,
  } = Ui as Record<string, React.ComponentType<Record<string, unknown>>>;

  const pricingTiers = [
    {
      id: 'free',
      name: 'Free',
      price: '$0',
      period: '/mo',
      description: 'For side projects and evaluation.',
      features: ['1 site', 'Community support', 'Core components'],
      cta: 'Get started',
      ctaHref: '#',
      highlighted: false,
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '$29',
      period: '/mo',
      description: 'For teams shipping in production.',
      features: ['Unlimited sites', 'AI agents', 'Priority support'],
      cta: 'Start free trial',
      ctaHref: '#',
      highlighted: true,
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 'Custom',
      description: 'For organizations with advanced needs.',
      features: ['SSO and SCIM', 'Dedicated support', 'Custom SLAs'],
      cta: 'Contact sales',
      ctaHref: '#',
      highlighted: false,
    },
  ];

  return {
    PricingTable: {
      subtitle: '3 tiers, highlighted plan',
      sections: [
        {
          label: 'Three tiers',
          node: React.createElement(PricingTable, { tiers: pricingTiers }),
        },
      ],
    },
    Dialog: {
      subtitle: 'Modal panel (representative snapshot)',
      sections: [
        {
          label: 'Open state',
          node: (
            <div className="dsc-dialog-panel">
              {React.createElement(DialogTitle, {}, 'Delete project')}
              {React.createElement(
                DialogDescription,
                {},
                'This action is permanent and cannot be undone.',
              )}
              {React.createElement(
                DialogBody,
                {},
                <p className="dsc-body-text">
                  The project and all of its data will be removed for every member of the workspace.
                </p>,
              )}
              {React.createElement(
                DialogActions,
                {},
                <>
                  {React.createElement(ButtonCVA, { variant: 'outline' }, 'Cancel')}
                  {React.createElement(ButtonCVA, { variant: 'destructive' }, 'Delete')}
                </>,
              )}
            </div>
          ),
        },
      ],
    },
    Drawer: {
      subtitle: 'Slide-out panel (representative snapshot)',
      sections: [
        {
          label: 'Open state',
          node: (
            <div className="dsc-drawer-panel">
              {React.createElement(DrawerHeader, { onClose: noop }, 'Filters')}
              {React.createElement(
                DrawerBody,
                {},
                <p className="dsc-body-text">
                  Refine the results using the controls in this panel.
                </p>,
              )}
              {React.createElement(
                DrawerFooter,
                {},
                <>
                  {React.createElement(ButtonCVA, { variant: 'outline' }, 'Reset')}
                  {React.createElement(ButtonCVA, { variant: 'primary' }, 'Apply')}
                </>,
              )}
            </div>
          ),
        },
      ],
    },
    Tooltip: {
      subtitle: 'Hover label (representative snapshot)',
      sections: [
        {
          label: 'Visible state',
          node: (
            <div className="dsc-tooltip-demo">
              {React.createElement(ButtonCVA, { variant: 'outline' }, 'Hover me')}
              <span className="dsc-tooltip-bubble" role="tooltip">
                Saves your changes
              </span>
            </div>
          ),
        },
      ],
    },
    ToastProvider: {
      subtitle: 'Notification stack (representative snapshot)',
      sections: [
        {
          label: 'Toasts',
          node: (
            <div className="dsc-toast-stack">
              <div className="dsc-toast">
                <p className="dsc-toast-title">Changes saved</p>
                <p className="dsc-toast-desc">Your workspace is up to date.</p>
              </div>
              <div className="dsc-toast dsc-toast-success">
                <span className="dsc-toast-icon">✓</span>
                <div>
                  <p className="dsc-toast-title">Deployment complete</p>
                  <p className="dsc-toast-desc">docs.revealui.com is live.</p>
                </div>
              </div>
              <div className="dsc-toast dsc-toast-error">
                <span className="dsc-toast-icon">!</span>
                <div>
                  <p className="dsc-toast-title">Upload failed</p>
                  <p className="dsc-toast-desc">Check your connection and retry.</p>
                </div>
              </div>
            </div>
          ),
        },
      ],
    },
  };
}

/**
 * Build the curated registry: export name → CuratedEntry. Async because the
 * docs showcase stories are lazy-loaded.
 */
export async function buildCuratedRegistry(): Promise<Map<string, CuratedEntry>> {
  const map = new Map<string, CuratedEntry>();

  for (const entry of showcaseEntries) {
    if (SKIP_SLUGS.has(entry.slug)) continue;
    const mod = await entry.loader();
    const story = mod.default;
    const targets = SLUG_ALIASES[entry.slug] ?? [kebabToPascal(entry.slug)];
    const curated: CuratedEntry = {
      subtitle: storySubtitle(story),
      sections: sectionsFromStory(story),
    };
    for (const name of targets) {
      map.set(name, curated);
    }
  }

  // Authored snapshots override any showcase-derived entry for those names.
  for (const [name, curated] of Object.entries(authoredSnapshots())) {
    map.set(name, curated);
  }

  return map;
}
