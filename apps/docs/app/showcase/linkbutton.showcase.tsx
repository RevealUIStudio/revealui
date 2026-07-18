import { LinkButton } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'linkbutton',
  name: 'LinkButton',
  description:
    'Button-styled element that renders as an anchor by default. Pairs with LinkBehaviorProvider to route through any framework Link component without coupling @revealui/presentation to a specific router.',
  category: 'component',

  controls: {
    variant: {
      type: 'select',
      options: ['brand', 'neutral', 'success', 'warning', 'danger'],
      default: 'brand',
    },
    appearance: {
      type: 'select',
      options: ['solid', 'outline', 'ghost', 'link'],
      default: 'solid',
    },
    size: {
      type: 'select',
      options: ['default', 'sm', 'lg', 'icon', 'clear'],
      default: 'default',
    },
    href: { type: 'text', default: '/contact' },
    external: { type: 'boolean', default: false },
    isLoading: { type: 'boolean', default: false },
    disabled: { type: 'boolean', default: false },
    children: { type: 'text', default: 'Book a call' },
  },

  render: (props: Record<string, unknown>) => (
    <LinkButton
      href={props.href as string}
      external={props.external as boolean}
      variant={props.variant as 'brand'}
      appearance={props.appearance as 'solid'}
      size={props.size as 'default'}
      isLoading={props.isLoading as boolean}
      disabled={props.disabled as boolean}
    >
      {props.children as string}
    </LinkButton>
  ),

  variantGrid: {
    variant: ['brand', 'neutral', 'success', 'warning', 'danger'],
    appearance: ['solid', 'outline', 'ghost', 'link'],
  },

  examples: [
    {
      name: 'Default (renders <a>)',
      description:
        'Without LinkBehaviorProvider, LinkButton renders a native anchor — SSR-safe, zero deps, works everywhere.',
      render: () => <LinkButton href="/contact">Book a call</LinkButton>,
    },
    {
      name: 'External link',
      description:
        'The `external` prop adds `target="_blank" rel="noopener noreferrer"` and opts out of any LinkBehaviorProvider so external links never route through SPA Link components.',
      render: () => (
        <LinkButton
          href="https://docs.revealui.com"
          external
          appearance="outline"
          variant="neutral"
        >
          Read the docs ↗
        </LinkButton>
      ),
    },
    {
      name: 'Loading state',
      render: () => (
        <LinkButton href="/contact" isLoading>
          Submitting…
        </LinkButton>
      ),
    },
    {
      name: 'Disabled',
      description:
        'Disabled anchors keep their `href` (semantics unchanged) but get `aria-disabled="true"`, `tabIndex={-1}`, and `pointer-events: none`.',
      render: () => (
        <LinkButton href="/contact" disabled>
          Coming soon
        </LinkButton>
      ),
    },
    {
      name: 'Per-instance polymorphic override',
      description:
        'Use `as` to render a single LinkButton via a specific component (e.g. for mixed-routing scenarios). The override drops the provider hrefProp and uses standard `href`.',
      render: () => (
        <LinkButton as="a" href="#anchor" appearance="ghost" variant="neutral">
          Jump to section
        </LinkButton>
      ),
    },
  ],

  code: (props: Record<string, unknown>) => {
    const attrs: string[] = [`href="${props.href}"`];
    if (props.external) attrs.push('external');
    if (props.variant !== 'brand') attrs.push(`variant="${props.variant}"`);
    if (props.appearance !== 'solid') attrs.push(`appearance="${props.appearance}"`);
    if (props.size !== 'default') attrs.push(`size="${props.size}"`);
    if (props.isLoading) attrs.push('isLoading');
    if (props.disabled) attrs.push('disabled');
    return `<LinkButton ${attrs.join(' ')}>${props.children}</LinkButton>`;
  },

  usage: {
    when: `Reach for **LinkButton** when you need a styled button that **navigates** — e.g. "Get Started", "Book a call", "Read the docs". Pairs with \`LinkBehaviorProvider\` to wire SPA navigation through any router (\`@revealui/router\`, Next.js \`Link\`, react-router) once at the app root, with no per-call-site setup.`,
    avoid: `Don't use LinkButton when:\n- You need a click handler that doesn't navigate (use **Button** instead).\n- The element is purely decorative or non-interactive (use a **div** or **span**).\n- You want a text-style inline link (use **Link** or **TextLink**).`,
  },

  install: 'npm install @revealui/presentation',
  sourceUrl: 'src/components/LinkButton.tsx',

  a11y: {
    conformance: ['WCAG 2.1.1 Keyboard', 'WCAG 2.4.4 Link Purpose (In Context)'],
    keyboard: {
      Enter: 'Activates the link (default anchor behavior).',
      Tab: 'Move focus to / from the link.',
    },
    aria: {
      'aria-disabled':
        'Set to "true" when `disabled`. Anchor `href` is preserved — semantics unchanged — but click is prevented and `tabIndex={-1}`.',
      'aria-busy': 'Set to "true" when `isLoading`.',
    },
    notes:
      'External links (`external` prop) add `rel="noopener noreferrer"` for tab-nap protection. The component wraps children in `TouchTarget` to ensure ≥44×44 mobile tap area, matching `Button` ergonomics.',
  },

  related: [
    { slug: 'button', reason: 'For non-navigating actions, use Button instead.' },
    { slug: 'link', reason: 'For inline text links, use Link.' },
  ],
};

export default story;
