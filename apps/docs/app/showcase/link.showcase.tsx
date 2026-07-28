import { Link } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'link',
  name: 'Link',
  description:
    'Framework-agnostic anchor wrapper with data-interactive attribute for consistent hover states.',
  category: 'component',

  controls: {
    children: { type: 'text', default: 'Visit RevealUI' },
    href: { type: 'text', default: '#' },
  },

  render: (props: Record<string, unknown>) => (
    <Link href={props.href as string}>{props.children as string}</Link>
  ),

  examples: [
    {
      name: 'Inline Links',
      render: () => (
        <p className="text-sm text-(--rvui-color-text)">
          Read the <Link href="#">documentation</Link>, check the <Link href="#">changelog</Link>,
          or visit our <Link href="#">GitHub repo</Link>.
        </p>
      ),
    },
  ],

  code: (props: Record<string, unknown>) => `<Link href="${props.href}">${props.children}</Link>`,

  a11y: {
    conformance: ['WCAG 2.2 2.1.1 Keyboard', 'WCAG 2.2 2.4.4 Link Purpose (In Context)'],
    keyboard: {
      Enter: 'Activates the link',
      Tab: 'Moves focus to the link',
    },
  },
};

export default story;
