import { Stat, StatGroup } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'stat',
  name: 'Stat',
  description:
    'Data display card with label, value, optional trend arrow, and description. Uses OKLCH token colors.',
  category: 'component',

  controls: {
    label: { type: 'text', default: 'Total Revenue' },
    value: { type: 'text', default: '$45,231.89' },
    change: { type: 'text', default: '+20.1%' },
    trend: { type: 'select', options: ['up', 'down', 'neutral'], default: 'up' },
    description: { type: 'text', default: 'from last month' },
  },

  render: (props) => (
    <Stat
      label={props.label as string}
      value={props.value as string}
      change={props.change as string}
      trend={props.trend as 'up' | 'down' | 'neutral'}
      description={props.description as string}
    />
  ),

  examples: [
    {
      name: 'Stat Group',
      render: () => (
        <StatGroup>
          <Stat
            label="Revenue"
            value="$45,231"
            change="+20.1%"
            trend="up"
            description="from last month"
          />
          <Stat label="Users" value="2,350" change="+180" trend="up" description="new this week" />
          <Stat
            label="Churn"
            value="3.2%"
            change="+0.4%"
            trend="down"
            description="vs last quarter"
          />
          <Stat
            label="Latency"
            value="42ms"
            change="0ms"
            trend="neutral"
            description="p99 response"
          />
        </StatGroup>
      ),
    },
    {
      name: 'Minimal (no trend)',
      render: () => <Stat label="Active Sessions" value="1,429" />,
    },
  ],

  code: (props) => {
    const attrs = [`label="${props.label}"`, `value="${props.value}"`];
    if (props.change) attrs.push(`change="${props.change}"`);
    if (props.trend !== 'up') attrs.push(`trend="${props.trend}"`);
    if (props.description) attrs.push(`description="${props.description}"`);
    return `<Stat\n  ${attrs.join('\n  ')}\n/>`;
  },
};

export default story;
