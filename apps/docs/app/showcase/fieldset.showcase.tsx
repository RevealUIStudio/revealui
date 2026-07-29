import {
  Description,
  ErrorMessage,
  Field,
  FieldGroup,
  Fieldset,
  FieldsetLabel,
  Input,
  Legend,
} from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'fieldset',
  name: 'Fieldset',
  description:
    'Semantic form grouping with legend, field labels, descriptions, and error messages.',
  category: 'component',

  controls: {
    disabled: { type: 'boolean', default: false },
  },

  render: (props: Record<string, unknown>) => (
    <Fieldset disabled={props.disabled as boolean}>
      <Legend>Account Details</Legend>
      <FieldGroup>
        <Field>
          <FieldsetLabel>Full Name</FieldsetLabel>
          <Input placeholder="Jane Doe" />
        </Field>
        <Field>
          <FieldsetLabel>Email</FieldsetLabel>
          <Description>We&apos;ll never share your email.</Description>
          <Input type="email" placeholder="jane@example.com" />
        </Field>
      </FieldGroup>
    </Fieldset>
  ),

  examples: [
    {
      name: 'With Validation Error',
      render: () => (
        <Fieldset>
          <Legend>Sign Up</Legend>
          <FieldGroup>
            <Field>
              <FieldsetLabel>Password</FieldsetLabel>
              <Input type="password" placeholder="••••••••" />
              <ErrorMessage>Password must be at least 8 characters.</ErrorMessage>
            </Field>
          </FieldGroup>
        </Fieldset>
      ),
    },
  ],

  code: (props: Record<string, unknown>) =>
    `<Fieldset${props.disabled ? ' disabled' : ''}>
  <Legend>Account Details</Legend>
  <FieldGroup>
    <Field>
      <Label>Full Name</Label>
      <Input placeholder="Jane Doe" />
    </Field>
    <Field>
      <Label>Email</Label>
      <Description>We'll never share your email.</Description>
      <Input type="email" placeholder="jane@example.com" />
    </Field>
  </FieldGroup>
</Fieldset>`,

  a11y: {
    conformance: ['WCAG 2.2 1.3.1 Info and Relationships', 'WCAG 2.2 3.3.2 Labels or Instructions'],
    notes: 'Use legend for the group name.',
  },
};

export default story;
