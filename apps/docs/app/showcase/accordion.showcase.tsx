import { Accordion, AccordionItem } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'accordion',
  name: 'Accordion',
  description:
    'Collapsible content sections with animated chevron. Supports default-open items and arbitrary content.',
  category: 'component',

  controls: {
    items: {
      type: 'number',
      default: 3,
      min: 1,
      max: 6,
      step: 1,
    },
    defaultOpen: { type: 'boolean', default: false },
  },

  render: (props) => {
    const count = props.items as number;
    const defaultOpen = props.defaultOpen as boolean;
    const items = Array.from({ length: count }, (_, i) => ({
      title: `Section ${i + 1}`,
      content: `Content for section ${i + 1}. This can contain any React content including paragraphs, lists, images, and nested components.`,
    }));

    return (
      <Accordion>
        {items.map((item, i) => (
          <AccordionItem key={item.title} title={item.title} defaultOpen={defaultOpen && i === 0}>
            <p>{item.content}</p>
          </AccordionItem>
        ))}
      </Accordion>
    );
  },

  examples: [
    {
      name: 'FAQ Pattern',
      render: () => (
        <Accordion>
          <AccordionItem title="What is RevealUI?">
            <p>
              RevealUI is the agentic business runtime that provides users, content, products,
              payments, and AI out of the box.
            </p>
          </AccordionItem>
          <AccordionItem title="Is it open source?">
            <p>
              Yes! The core packages are MIT licensed. Pro features like AI agents are commercially
              licensed.
            </p>
          </AccordionItem>
          <AccordionItem title="How do I get started?">
            <p>
              Run <code>npx create-revealui</code> to scaffold a new project with everything
              pre-wired.
            </p>
          </AccordionItem>
        </Accordion>
      ),
    },
    {
      name: 'Default Open',
      render: () => (
        <Accordion>
          <AccordionItem title="First item (open by default)" defaultOpen>
            <p>This item starts expanded so users see the most important content immediately.</p>
          </AccordionItem>
          <AccordionItem title="Second item">
            <p>Click to expand this section.</p>
          </AccordionItem>
        </Accordion>
      ),
    },
  ],

  code: (props) => {
    const open = props.defaultOpen ? ' defaultOpen' : '';
    return `<Accordion>
  <AccordionItem title="Section 1"${open}>
    <p>Content here...</p>
  </AccordionItem>
</Accordion>`;
  },
};

export default story;
