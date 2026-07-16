import { VerdictChip } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const verdicts = ['approve', 'request-changes', 'hold', 'pending'];

const story: ShowcaseStory = {
  slug: 'verdict-chip',
  name: 'Verdict Chip',
  description:
    'A guardrail verdict rendered as a compact chip: a semantic icon, the verdict word, and an optional actor. Semantic --rvui-* color per verdict; color is never the only cue.',
  category: 'component',
  sourceUrl: 'src/components/verdict-chip.tsx',

  controls: {
    verdict: { type: 'select', options: verdicts, default: 'approve' },
    actor: { type: 'text', default: 'agent-system' },
    asOf: { type: 'text', default: '2026-07-16' },
  },

  render: (props: Record<string, unknown>) => (
    <VerdictChip
      verdict={props.verdict as 'approve'}
      actor={props.actor as string}
      asOf={props.asOf as string}
    />
  ),

  variantGrid: {
    verdict: verdicts,
  },

  examples: [
    {
      name: 'Review outcomes',
      render: () => (
        <div className="flex flex-wrap gap-2">
          <VerdictChip verdict="approve" actor="alice" />
          <VerdictChip verdict="request-changes" actor="bob" />
          <VerdictChip verdict="hold" actor="carol" />
          <VerdictChip verdict="pending" />
        </div>
      ),
    },
  ],

  a11y: {
    conformance: ['WCAG 1.4.1 Use of Color'],
    aria: {
      'role="img"': 'The chip announces the verdict, actor, and time as one phrase.',
      'aria-label': 'Composed, e.g. "Approved by alice as of 2026-07-16".',
    },
    notes: 'The verdict word is always visible, so meaning never depends on color alone.',
  },

  code: (props: Record<string, unknown>) => {
    const attrs = [`verdict="${props.verdict}"`];
    if (props.actor) attrs.push(`actor="${props.actor}"`);
    if (props.asOf) attrs.push(`asOf="${props.asOf}"`);
    return `<VerdictChip ${attrs.join(' ')} />`;
  },
};

export default story;
