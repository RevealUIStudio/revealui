import { RevealUIWordmark } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'wordmark',
  name: 'Wordmark',
  description:
    'The RevealUI wordmark: the Circuit-R monogram plus "RevealUI" set in the brand display face. "Reveal" tracks --rvui-brand-text and "UI" tracks --rvui-accent, both flipping automatically across the light and dark token ladders.',
  category: 'component',
  sourceUrl: 'src/components/wordmark.tsx',

  controls: {
    reveal: { type: 'boolean', default: true },
  },

  render: (props: Record<string, unknown>) => (
    <RevealUIWordmark className="text-4xl" reveal={props.reveal as boolean} />
  ),

  examples: [
    {
      name: 'Size scale',
      render: () => (
        <div className="flex flex-col items-start gap-4">
          <RevealUIWordmark className="text-2xl" />
          <RevealUIWordmark className="text-3xl" />
          <RevealUIWordmark className="text-4xl" />
        </div>
      ),
    },
    {
      name: 'Mono monogram',
      render: () => <RevealUIWordmark className="text-3xl" reveal={false} />,
    },
  ],

  a11y: {
    notes:
      'The wordmark text is real HTML (not SVG text), so it inherits the display face and remains selectable and screen-reader legible as "RevealUI".',
  },

  code: (props: Record<string, unknown>) => {
    const attrs = ['className="text-4xl"'];
    if (!(props.reveal as boolean)) attrs.push('reveal={false}');
    return `<RevealUIWordmark ${attrs.join(' ')} />`;
  },
};

export default story;
