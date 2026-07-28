import { AuthLayout } from '@revealui/presentation';
import { Button, Heading, Input, Text } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'auth-layout',
  name: 'Auth Layout',
  description: 'Centered single-column auth shell for sign-in and similar pages.',
  category: 'component',
  sourceUrl: 'src/components/auth-layout.tsx',
  controls: {},
  render: () => (
    <div className="h-[28rem] w-full overflow-hidden rounded-lg border border-border">
      <AuthLayout
        header={<Heading level={2}>Sign in</Heading>}
        footer={
          <Text className="text-sm text-muted-foreground">
            Need an account? Contact your admin.
          </Text>
        }
      >
        <form className="flex w-72 flex-col gap-3" onSubmit={(e) => e.preventDefault()}>
          <Input type="email" placeholder="you@example.com" aria-label="Email" />
          <Input type="password" placeholder="Password" aria-label="Password" />
          <Button type="submit">Continue</Button>
        </form>
      </AuthLayout>
    </div>
  ),
  code: () => `<AuthLayout header={...} footer={...}>{/* form */}</AuthLayout>`,
  a11y: {
    conformance: ['WCAG 2.2 1.3.1 Info and Relationships'],
    notes: 'Renders a main landmark. Provide labelled controls inside children.',
  },
};

export default story;
