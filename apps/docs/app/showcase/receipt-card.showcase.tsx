import { ReceiptCard } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const demoLines = [
  { ts: '2026-07-16T14:01Z', actor: 'alice', action: 'opened', object: 'claim #42' },
  {
    ts: '2026-07-16T14:03Z',
    actor: 'agent-system',
    action: 'approved',
    object: 'claim #42',
    refId: 'rcpt_8f21ac',
  },
  {
    ts: '2026-07-16T14:07Z',
    actor: 'agent-system',
    action: 'paid out',
    object: '$120.00',
    refId: 'rcpt_9c04de',
  },
];

const story: ShowcaseStory = {
  slug: 'receipt-card',
  name: 'Receipt Card',
  description:
    'A titled header, a stack of audit lines, and an optional integrity footer. The carrier of the "if an agent did it, there’s a receipt" motif.',
  category: 'component',
  sourceUrl: 'src/components/receipt-card.tsx',

  controls: {
    title: { type: 'text', default: 'Claim #42 receipt' },
    integrity: { type: 'boolean', default: true },
  },

  render: (props: Record<string, unknown>) => (
    <ReceiptCard
      title={props.title as string}
      lines={demoLines}
      integrity={props.integrity ? { kind: 'sha256', value: 'a1b2c3d4e5f6a7b8' } : undefined}
      className="w-full max-w-md"
    />
  ),

  examples: [
    {
      name: 'Without an integrity seal',
      render: () => (
        <ReceiptCard title="Session log" lines={demoLines} className="w-full max-w-md" />
      ),
    },
  ],

  a11y: {
    aria: {
      'role="region"': 'The receipt is a region labelled by its title.',
      '<ul>/<li>': 'Audit lines compose as a list.',
    },
    notes:
      'The integrity value copies on click through the same accessible affordance as AuditLine.',
  },

  related: [
    { slug: 'audit-line', reason: 'ReceiptCard composes AuditLine.' },
    { slug: 'verdict-chip', reason: 'Both render governance receipts.' },
  ],
};

export default story;
