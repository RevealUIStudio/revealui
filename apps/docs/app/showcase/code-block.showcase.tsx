import { CodeBlock } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'code-block',
  name: 'Code Block',
  description: 'Code display with optional filename, language label, and copy button.',
  category: 'component',

  controls: {
    language: { type: 'text', default: 'tsx' },
    filename: { type: 'text', default: 'App.tsx' },
    showCopy: { type: 'boolean', default: true },
  },

  render: (props) => (
    <CodeBlock
      code={`import { Button } from '@revealui/presentation/server';

export function App() {
  return <Button variant="primary">Click me</Button>;
}`}
      language={props.language as string}
      filename={props.filename as string}
      showCopy={props.showCopy as boolean}
    />
  ),

  examples: [
    {
      name: 'Shell Command',
      render: () => <CodeBlock code="npx create-revealui my-app" language="bash" />,
    },
    {
      name: 'JSON Config',
      render: () => (
        <CodeBlock
          code={`{
  "name": "@revealui/core",
  "version": "0.4.0",
  "type": "module"
}`}
          language="json"
          filename="package.json"
        />
      ),
    },
  ],

  code: (props) =>
    `<CodeBlock
  code="const x = 1;"
  language="${props.language}"${props.filename ? `\n  filename="${props.filename}"` : ''}${!props.showCopy ? '\n  showCopy={false}' : ''}
/>`,
};

export default story;
