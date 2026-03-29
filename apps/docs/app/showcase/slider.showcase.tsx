import { Slider } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'slider',
  name: 'Slider',
  description: 'Range slider with configurable min, max, step, label, and value display.',
  category: 'component',

  controls: {
    min: { type: 'number', default: 0, min: 0, max: 100 },
    max: { type: 'number', default: 100, min: 0, max: 1000 },
    step: { type: 'number', default: 1, min: 1, max: 50 },
    showValue: { type: 'boolean', default: true },
    disabled: { type: 'boolean', default: false },
  },

  render: (props) => (
    <div className="w-72">
      <Slider
        defaultValue={50}
        min={props.min as number}
        max={props.max as number}
        step={props.step as number}
        showValue={props.showValue as boolean}
        disabled={props.disabled as boolean}
        label="Volume"
      />
    </div>
  ),

  examples: [
    {
      name: 'Price Range',
      render: () => (
        <div className="w-72">
          <Slider defaultValue={250} min={0} max={1000} step={10} showValue label="Max Price" />
        </div>
      ),
    },
    {
      name: 'Disabled',
      render: () => (
        <div className="w-72">
          <Slider defaultValue={30} disabled label="Locked" />
        </div>
      ),
    },
  ],

  code: (props) => {
    const attrs: string[] = ['defaultValue={50}'];
    if (props.min !== 0) attrs.push(`min={${props.min}}`);
    if (props.max !== 100) attrs.push(`max={${props.max}}`);
    if (props.step !== 1) attrs.push(`step={${props.step}}`);
    if (props.showValue) attrs.push('showValue');
    if (props.disabled) attrs.push('disabled');
    attrs.push('label="Volume"');
    return `<Slider ${attrs.join(' ')} />`;
  },
};

export default story;
