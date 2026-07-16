import { StatusDot } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const statuses = ['ok', 'warn', 'error', 'idle'];

const story: ShowcaseStory = {
  slug: 'status-dot',
  name: 'Status Dot',
  description:
    'A small token-filled status indicator with an optional pulse and a required screen-reader label. Semantic --rvui-* variants; the pulse honors prefers-reduced-motion.',
  category: 'component',
  sourceUrl: 'src/components/status-dot.tsx',

  controls: {
    status: { type: 'select', options: statuses, default: 'ok' },
    pulse: { type: 'boolean', default: false },
    label: { type: 'text', default: 'API: healthy' },
  },

  render: (props: Record<string, unknown>) => (
    <StatusDot
      status={props.status as 'ok'}
      pulse={props.pulse as boolean}
      label={props.label as string}
    />
  ),

  variantGrid: {
    status: statuses,
  },

  examples: [
    {
      name: 'With a label beside the dot',
      render: () => (
        <div className="flex flex-col gap-2 text-sm text-text-secondary">
          <span className="inline-flex items-center gap-2">
            <StatusDot status="ok" label="Database: healthy" /> Database
          </span>
          <span className="inline-flex items-center gap-2">
            <StatusDot status="warn" label="Queue: degraded" /> Queue
          </span>
          <span className="inline-flex items-center gap-2">
            <StatusDot status="error" label="Webhook: failing" /> Webhook
          </span>
          <span className="inline-flex items-center gap-2">
            <StatusDot status="idle" label="Worker: idle" /> Worker
          </span>
        </div>
      ),
    },
    {
      name: 'Live (pulsing)',
      render: () => (
        <span className="inline-flex items-center gap-2 text-sm text-text-secondary">
          <StatusDot status="ok" label="Stream: live" pulse /> Streaming
        </span>
      ),
    },
  ],

  a11y: {
    conformance: ['WCAG 1.4.1 Use of Color', 'WCAG 2.3.3 Animation from Interactions'],
    aria: {
      'role="img"': 'The dot exposes its status as an image with an aria-label.',
      'aria-label': 'Required — color alone is not an accessible status cue.',
    },
    notes:
      'The pulse ring is suppressed when the user requests reduced motion. Always pass a descriptive label such as "Database: healthy".',
  },

  code: (props: Record<string, unknown>) => {
    const attrs = [`status="${props.status}"`, `label="${props.label}"`];
    if (props.pulse) attrs.push('pulse');
    return `<StatusDot ${attrs.join(' ')} />`;
  },
};

export default story;
