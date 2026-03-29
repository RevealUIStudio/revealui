import {
  ButtonCVA as Button,
  EmptyState,
  IconPlus,
  IconSearch,
  IconUpload,
} from '@revealui/presentation/server';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'empty-state',
  name: 'Empty State',
  description:
    'Placeholder for empty lists, search results, or content areas. Supports icon, title, description, and action.',
  category: 'component',

  controls: {
    title: { type: 'text', default: 'No results found' },
    description: { type: 'text', default: 'Try adjusting your search or filters.' },
    showAction: { type: 'boolean', default: true },
    showIcon: { type: 'boolean', default: true },
  },

  render: (props) => (
    <EmptyState
      icon={props.showIcon ? <IconSearch size="lg" /> : undefined}
      title={props.title as string}
      description={props.description as string}
      action={
        props.showAction ? (
          <Button variant="primary" size="sm">
            Clear filters
          </Button>
        ) : undefined
      }
    />
  ),

  examples: [
    {
      name: 'No Projects',
      render: () => (
        <EmptyState
          icon={<IconPlus size="lg" />}
          title="No projects yet"
          description="Create your first project to get started."
          action={
            <Button variant="primary" size="sm">
              <IconPlus size="xs" /> New Project
            </Button>
          }
        />
      ),
    },
    {
      name: 'Upload Area',
      render: () => (
        <EmptyState
          icon={<IconUpload size="lg" />}
          title="Drop files here"
          description="Or click to browse. Max 10MB per file."
        />
      ),
    },
    {
      name: 'Minimal',
      render: () => <EmptyState title="Nothing here" />,
    },
  ],

  code: (props) => {
    const attrs: string[] = [];
    if (props.showIcon) attrs.push('icon={<IconSearch size="lg" />}');
    attrs.push(`title="${props.title}"`);
    if (props.description) attrs.push(`description="${props.description}"`);
    if (props.showAction) attrs.push('action={<Button>Clear filters</Button>}');
    return `<EmptyState\n  ${attrs.join('\n  ')}\n/>`;
  },
};

export default story;
