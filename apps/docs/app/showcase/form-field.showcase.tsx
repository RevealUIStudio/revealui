import { FormField, Input } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'form-field',
  name: 'Form Field',
  description:
    'A labeled field wrapper composing FormLabel, a control, and either helper text or an error message. Wires the accessible relationships (label htmlFor, description/error ids) around any input, select, or textarea.',
  category: 'component',
  sourceUrl: 'src/components/form-field.tsx',

  controls: {
    label: { type: 'text', default: 'Email address' },
    required: { type: 'boolean', default: true },
    description: { type: 'text', default: 'We only use this for receipts.' },
    error: { type: 'text', default: '', placeholder: 'Set to preview the error state' },
  },

  render: (props: Record<string, unknown>) => {
    const error = (props.error as string) || undefined;
    return (
      <div className="w-80">
        <FormField
          id="ff-showcase"
          label={props.label as string}
          required={props.required as boolean}
          description={props.description as string}
          error={error}
        >
          <Input
            id="ff-showcase"
            type="email"
            placeholder="you@example.com"
            aria-invalid={error ? true : undefined}
          />
        </FormField>
      </div>
    );
  },

  examples: [
    {
      name: 'Default, required, and error states',
      render: () => (
        <div className="flex w-80 flex-col gap-6">
          <FormField id="ff-a" label="Full name" description="As it appears on your card.">
            <Input id="ff-a" placeholder="Ada Lovelace" />
          </FormField>
          <FormField id="ff-b" label="Email address" required description="Used for receipts.">
            <Input id="ff-b" type="email" placeholder="you@example.com" />
          </FormField>
          <FormField id="ff-c" label="Workspace slug" required error="That slug is already taken.">
            <Input id="ff-c" defaultValue="acme" aria-invalid />
          </FormField>
        </div>
      ),
    },
  ],

  a11y: {
    conformance: ['WCAG 1.3.1 Info and Relationships', 'WCAG 3.3.1 Error Identification'],
    aria: {
      'role="alert"': 'The error message is announced when it appears.',
      'aria-invalid': 'Set on the control by the consumer when an error is present.',
    },
    notes:
      'The child control must carry the same id passed to FormField so the label associates correctly. Helper text is hidden while an error is shown to avoid duplicate descriptions.',
  },

  related: [{ slug: 'label', reason: 'FormField builds on FormLabel.' }],

  code: (props: Record<string, unknown>) =>
    [
      `<FormField id="email" label="${props.label}"${props.required ? ' required' : ''}`,
      props.description ? ` description="${props.description}"` : '',
      props.error ? ` error="${props.error}"` : '',
      '>',
      '\n  <Input id="email" type="email" />',
      '\n</FormField>',
    ].join(''),
};

export default story;
