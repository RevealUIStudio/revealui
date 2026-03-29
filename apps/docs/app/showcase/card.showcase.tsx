import {
  ButtonCVA as Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@revealui/presentation/server';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'card',
  name: 'Card',
  description:
    'Compositional container with header, title, description, content, and footer sub-components.',
  category: 'component',

  controls: {
    title: { type: 'text', default: 'Card Title' },
    description: { type: 'text', default: 'Card description goes here.' },
    content: {
      type: 'text',
      default: 'This is the card body content. It can contain any React elements.',
    },
    showFooter: { type: 'boolean', default: true },
  },

  render: (props) => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>{props.title as string}</CardTitle>
        <CardDescription>{props.description as string}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm" style={{ color: 'var(--rvui-text-1, inherit)' }}>
          {props.content as string}
        </p>
      </CardContent>
      {(props.showFooter as boolean) && (
        <CardFooter className="gap-2">
          <Button variant="primary" size="sm">
            Save
          </Button>
          <Button variant="outline" size="sm">
            Cancel
          </Button>
        </CardFooter>
      )}
    </Card>
  ),

  examples: [
    {
      name: 'Minimal Card',
      render: () => (
        <Card className="w-[300px]">
          <CardContent className="pt-6">
            <p className="text-sm" style={{ color: 'var(--rvui-text-1, inherit)' }}>
              A card with only content, no header or footer.
            </p>
          </CardContent>
        </Card>
      ),
    },
    {
      name: 'Card Grid',
      render: () => (
        <div className="grid gap-4 sm:grid-cols-2">
          {['Users', 'Revenue', 'Orders', 'Growth'].map((title) => (
            <Card key={title}>
              <CardHeader>
                <CardTitle className="text-base">{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold" style={{ color: 'var(--rvui-text-0, inherit)' }}>
                  {Math.floor(Math.random() * 10000).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ),
    },
  ],

  code: (props) => {
    const lines = [
      '<Card>',
      '  <CardHeader>',
      `    <CardTitle>${props.title}</CardTitle>`,
      `    <CardDescription>${props.description}</CardDescription>`,
      '  </CardHeader>',
      '  <CardContent>',
      `    <p>${props.content}</p>`,
      '  </CardContent>',
    ];
    if (props.showFooter) {
      lines.push(
        '  <CardFooter>',
        '    <Button variant="primary" size="sm">Save</Button>',
        '    <Button variant="outline" size="sm">Cancel</Button>',
        '  </CardFooter>',
      );
    }
    lines.push('</Card>');
    return lines.join('\n');
  },
};

export default story;
