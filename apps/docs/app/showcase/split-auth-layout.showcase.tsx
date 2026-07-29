import { SplitAuthLayout } from '@revealui/presentation';
import { Button, Heading, Input, Text } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'split-auth-layout',
  name: 'Split Auth Layout',
  description:
    'Two-panel auth shell: brand surface on one side, form on the other. Stacks on small viewports.',
  category: 'component',
  sourceUrl: 'src/components/split-auth-layout.tsx',
  controls: {
    brandSurface: { type: 'select', options: ['tenant', 'surface-3'], default: 'surface-3' },
  },
  render: (props: Record<string, unknown>) => (
    <div className="h-[28rem] w-full overflow-hidden rounded-lg border border-border">
      <SplitAuthLayout
        brandSurface={props.brandSurface as 'tenant' | 'surface-3'}
        brand={
          <div className="flex flex-col gap-2 p-6 text-foreground">
            <Heading level={2}>RevealUI</Heading>
            <Text className="text-sm text-body">Governed agents on your infrastructure.</Text>
          </div>
        }
      >
        <form
          className="flex w-full max-w-sm flex-col gap-3 p-6 text-foreground"
          onSubmit={(e) => e.preventDefault()}
        >
          <Heading level={3}>Sign in</Heading>
          <Input type="email" placeholder="you@example.com" aria-label="Email" />
          <Button type="submit">Continue</Button>
        </form>
      </SplitAuthLayout>
    </div>
  ),
  code: (props: Record<string, unknown>) =>
    `<SplitAuthLayout brandSurface="${props.brandSurface}" brand={...}>{/* form */}</SplitAuthLayout>`,
  a11y: {
    conformance: ['WCAG 2.2 1.3.1 Info and Relationships', 'WCAG 2.2 1.4.3 Contrast (Minimum)'],
    notes: 'Set --tenant-brand-on when using a custom brand surface so brand text meets contrast.',
  },
};

export default story;
