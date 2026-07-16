import { AuditLine } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'audit-line',
  name: 'Audit Line',
  description:
    'A monospace ledger line: timestamp, actor, action, object, and an optional copy-on-click receipt reference. Tabular-nums for vertical register. The receipt motif’s atom.',
  category: 'component',
  sourceUrl: 'src/components/audit-line.tsx',

  controls: {
    ts: { type: 'text', default: '2026-07-16T14:03Z' },
    actor: { type: 'text', default: 'agent-system' },
    action: { type: 'text', default: 'approved' },
    object: { type: 'text', default: 'claim #42' },
    refId: { type: 'text', default: 'rcpt_8f21ac' },
    dense: { type: 'boolean', default: false },
  },

  render: (props: Record<string, unknown>) => (
    <AuditLine
      event={{
        ts: props.ts as string,
        actor: props.actor as string,
        action: props.action as string,
        object: props.object as string,
        refId: (props.refId as string) || undefined,
      }}
      dense={props.dense as boolean}
    />
  ),

  examples: [
    {
      name: 'Ledger stack',
      render: () => (
        <div className="flex flex-col gap-1">
          <AuditLine
            event={{
              ts: '2026-07-16T14:01Z',
              actor: 'alice',
              action: 'opened',
              object: 'claim #42',
            }}
          />
          <AuditLine
            event={{
              ts: '2026-07-16T14:03Z',
              actor: 'agent-system',
              action: 'approved',
              object: 'claim #42',
              refId: 'rcpt_8f21ac',
            }}
          />
          <AuditLine
            event={{
              ts: '2026-07-16T14:07Z',
              actor: 'agent-system',
              action: 'paid out',
              object: '$120.00',
              refId: 'rcpt_9c04de',
            }}
          />
        </div>
      ),
    },
    {
      name: 'Dense',
      render: () => (
        <AuditLine
          dense
          event={{
            ts: '2026-07-16T14:03Z',
            actor: 'agent-system',
            action: 'approved',
            object: 'claim #42',
            refId: 'rcpt_8f21ac',
          }}
        />
      ),
    },
  ],

  a11y: {
    conformance: ['WCAG 2.1.1 Keyboard'],
    aria: {
      '<time>': 'The timestamp is a semantic time element carrying a dateTime.',
      'aria-label': 'The reference is a button labelled "Copy reference <id>".',
    },
    notes:
      'The receipt reference copies to the clipboard on click; a visually-hidden live region announces the copy.',
  },
};

export default story;
