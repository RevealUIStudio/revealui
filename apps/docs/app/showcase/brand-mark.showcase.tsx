import { RevealUIMark } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'brand-mark',
  name: 'Brand Mark',
  description:
    'The RevealUI logomark. Renders the kit master asset. Light and dark files are the same bytes. No inline letterform and no invert. Decorative by default; pass a title to name it.',
  category: 'component',
  sourceUrl: 'src/components/brand-mark.tsx',

  controls: {
    reveal: { type: 'boolean', default: true },
    title: { type: 'text', default: 'RevealUI' },
  },

  render: (props: Record<string, unknown>) => (
    <RevealUIMark
      className="h-16 w-auto text-primary"
      reveal={props.reveal as boolean}
      title={props.title as string}
    />
  ),

  examples: [
    {
      name: 'Kit master',
      render: () => (
        <div className="flex items-end gap-8 text-primary">
          <div className="flex flex-col items-center gap-2">
            <RevealUIMark className="h-16 w-auto" reveal title="RevealUI" />
            <span className="text-xs text-muted-foreground">light file</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <RevealUIMark className="h-16 w-auto" reveal={false} title="RevealUI" />
            <span className="text-xs text-muted-foreground">same master</span>
          </div>
        </div>
      ),
    },
    {
      name: 'Same master on every surface',
      render: () => (
        <div className="flex items-end gap-8">
          <RevealUIMark className="h-12 w-auto text-foreground" reveal={false} title="Foreground" />
          <RevealUIMark className="h-12 w-auto text-primary" reveal={false} title="Primary" />
          <RevealUIMark
            className="h-12 w-auto text-muted-foreground"
            reveal={false}
            title="Muted"
          />
        </div>
      ),
    },
  ],

  a11y: {
    aria: {
      'role="img"': 'Set when a title is provided; the title becomes the accessible name.',
      'aria-hidden': 'Applied automatically when no title is passed (decorative mark).',
    },
    notes:
      'Omit the title when the mark sits beside a text lockup that already names the brand; pass a title when the mark stands alone.',
  },

  code: (props: Record<string, unknown>) => {
    const attrs = ['className="h-16 w-auto text-primary"'];
    if (!(props.reveal as boolean)) attrs.push('reveal={false}');
    if (props.title) attrs.push(`title="${props.title}"`);
    return `<RevealUIMark ${attrs.join(' ')} />`;
  },
};

export default story;
