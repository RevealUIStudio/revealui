import { Timeline, TimelineItem } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'timeline',
  name: 'Timeline',
  description: 'Vertical timeline with optional icons, dates, titles, and descriptions.',
  category: 'component',

  controls: {
    items: {
      type: 'range',
      default: 4,
      min: 2,
      max: 6,
      step: 1,
    },
  },

  render: (props) => {
    const count = props.items as number;
    const events = [
      { title: 'Project created', date: 'Jan 1', description: 'Initial repository setup' },
      { title: 'Alpha release', date: 'Feb 15', description: 'First internal release' },
      { title: 'Beta release', date: 'Mar 1', description: 'Public beta with 50+ components' },
      { title: 'v1.0 Launch', date: 'Mar 20', description: 'Production release on npm' },
      { title: 'Community milestone', date: 'Apr 5', description: '1,000 GitHub stars' },
      { title: 'Enterprise tier', date: 'May 1', description: 'Forge tier with unlimited sites' },
    ].slice(0, count);

    return (
      <Timeline>
        {events.map((event, i) => (
          <TimelineItem
            key={event.title}
            title={event.title}
            date={event.date}
            description={event.description}
            isLast={i === events.length - 1}
          />
        ))}
      </Timeline>
    );
  },

  examples: [
    {
      name: 'Minimal',
      render: () => (
        <Timeline>
          <TimelineItem title="Started" date="9:00 AM" />
          <TimelineItem title="In Progress" date="10:30 AM" description="Working on it" />
          <TimelineItem title="Completed" date="2:00 PM" isLast />
        </Timeline>
      ),
    },
  ],

  code: () =>
    `<Timeline>
  <TimelineItem title="Event" date="Jan 1" description="Details" />
  <TimelineItem title="Event 2" date="Feb 1" isLast />
</Timeline>`,
};

export default story;
