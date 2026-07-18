import { FormLabel, Label } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'label',
  name: 'Label',
  description:
    'Form label primitives. Label is the base styled <label>; FormLabel adds a required-asterisk affordance in --destructive. Both associate to a control via htmlFor.',
  category: 'component',
  sourceUrl: 'src/components/Label.tsx',

  controls: {
    text: { type: 'text', default: 'Email address' },
    required: { type: 'boolean', default: false },
  },

  render: (props: Record<string, unknown>) => (
    <FormLabel htmlFor="showcase-input" required={props.required as boolean}>
      {props.text as string}
    </FormLabel>
  ),

  examples: [
    {
      name: 'Base Label vs FormLabel',
      render: () => (
        <div className="flex flex-col gap-3">
          <Label htmlFor="a">Base label</Label>
          <FormLabel htmlFor="b">Form label (optional)</FormLabel>
          <FormLabel htmlFor="c" required>
            Form label (required)
          </FormLabel>
        </div>
      ),
    },
  ],

  a11y: {
    conformance: ['WCAG 1.3.1 Info and Relationships', 'WCAG 3.3.2 Labels or Instructions'],
    notes:
      'Always set htmlFor to the id of the control the label describes. The required asterisk is a visual cue only — also convey required state on the control itself (e.g. aria-required).',
  },

  code: (props: Record<string, unknown>) => {
    const attrs = ['htmlFor="email"'];
    if (props.required) attrs.push('required');
    return `<FormLabel ${attrs.join(' ')}>${props.text}</FormLabel>`;
  },
};

export default story;
