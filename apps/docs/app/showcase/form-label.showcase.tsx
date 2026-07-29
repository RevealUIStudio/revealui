import { FormLabel, Input } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'form-label',
  name: 'Form Label',
  description:
    'Label with optional required marker. Prefer FormField when wiring description and error text; use FormLabel when composing a custom field.',
  category: 'component',
  sourceUrl: 'src/components/FormLabel.tsx',
  controls: {
    required: { type: 'boolean', default: true },
    label: { type: 'text', default: 'Email' },
  },
  render: (props: Record<string, unknown>) => (
    <div className="flex w-72 flex-col gap-2">
      <FormLabel htmlFor="fl-demo" required={props.required as boolean}>
        {props.label as string}
      </FormLabel>
      <Input id="fl-demo" type="email" placeholder="you@example.com" />
    </div>
  ),
  examples: [
    {
      name: 'Required marker',
      render: () => (
        <div className="flex w-72 flex-col gap-2">
          <FormLabel htmlFor="fl-req" required>
            Workspace name
          </FormLabel>
          <Input id="fl-req" defaultValue="Acme" />
        </div>
      ),
    },
  ],
  code: (props: Record<string, unknown>) =>
    `<FormLabel htmlFor="field"${props.required ? ' required' : ''}>${props.label}</FormLabel>`,
  a11y: {
    conformance: ['WCAG 2.2 1.3.1 Info and Relationships', 'WCAG 2.2 3.3.2 Labels or Instructions'],
    keyboard: { Tab: 'Moves focus to the associated control via label htmlFor' },
    aria: { for: 'Associates the label with a control id' },
    notes: 'Required marker is visible text (*); pair with aria-required on the control.',
  },
};

export default story;
