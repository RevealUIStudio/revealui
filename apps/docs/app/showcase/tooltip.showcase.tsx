import { Tooltip } from '@revealui/presentation/client';
import { ButtonCVA as Button } from '@revealui/presentation/server';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'tooltip',
  name: 'Tooltip',
  description:
    'Contextual information on hover/focus with configurable position and delay. Supports rich content.',
  category: 'component',

  controls: {
    content: { type: 'text', default: 'Helpful tooltip text' },
    side: {
      type: 'select',
      options: ['top', 'bottom', 'left', 'right'],
      default: 'top',
    },
    delay: {
      type: 'range',
      default: 200,
      min: 0,
      max: 1000,
      step: 50,
    },
  },

  render: (props) => (
    <div className="flex items-center justify-center py-12">
      <Tooltip
        content={props.content as string}
        side={props.side as 'top' | 'bottom' | 'left' | 'right'}
        delay={props.delay as number}
      >
        <Button>Hover me</Button>
      </Tooltip>
    </div>
  ),

  variantGrid: {
    side: ['top', 'bottom', 'left', 'right'],
  },

  examples: [
    {
      name: 'All Positions',
      render: () => (
        <div className="flex flex-wrap items-center justify-center gap-6 py-8">
          {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
            <Tooltip key={side} content={`Tooltip on ${side}`} side={side}>
              <Button variant="outline">{side}</Button>
            </Tooltip>
          ))}
        </div>
      ),
    },
    {
      name: 'Instant vs Delayed',
      render: () => (
        <div className="flex items-center gap-6 py-8">
          <Tooltip content="No delay" delay={0}>
            <Button variant="ghost">Instant</Button>
          </Tooltip>
          <Tooltip content="500ms delay" delay={500}>
            <Button variant="ghost">Slow</Button>
          </Tooltip>
        </div>
      ),
    },
  ],

  code: (props) => {
    const attrs: string[] = [`content="${props.content}"`];
    if (props.side !== 'top') attrs.push(`side="${props.side}"`);
    if (props.delay !== 200) attrs.push(`delay={${props.delay}}`);
    return `<Tooltip ${attrs.join(' ')}>
  <Button>Hover me</Button>
</Tooltip>`;
  },
};

export default story;
