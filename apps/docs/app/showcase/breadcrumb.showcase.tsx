import { Breadcrumb } from '@revealui/presentation/server';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'breadcrumb',
  name: 'Breadcrumb',
  description: 'Navigation breadcrumb trail from an items array. Custom separator support.',
  category: 'component',

  controls: {
    depth: {
      type: 'range',
      default: 3,
      min: 1,
      max: 6,
      step: 1,
    },
  },

  render: (props) => {
    const depth = props.depth as number;
    const allItems = [
      { label: 'Home', href: '#' },
      { label: 'Products', href: '#' },
      { label: 'Electronics', href: '#' },
      { label: 'Laptops', href: '#' },
      { label: 'Gaming', href: '#' },
      { label: 'ASUS ROG' },
    ];
    const items = allItems.slice(0, depth);

    return <Breadcrumb items={items} />;
  },

  examples: [
    {
      name: 'Simple Path',
      render: () => (
        <Breadcrumb
          items={[
            { label: 'Home', href: '#' },
            { label: 'Settings', href: '#' },
            { label: 'Profile' },
          ]}
        />
      ),
    },
    {
      name: 'Custom Separator',
      render: () => (
        <Breadcrumb
          items={[
            { label: 'Docs', href: '#' },
            { label: 'API Reference', href: '#' },
            { label: 'useTheme' },
          ]}
          separator={<span className="text-(--rvui-color-text-secondary)">/</span>}
        />
      ),
    },
  ],

  code: (props) => {
    const depth = props.depth as number;
    const items = [
      '{ label: "Home", href: "/" }',
      '{ label: "Products", href: "/products" }',
      '{ label: "Electronics", href: "/electronics" }',
      '{ label: "Laptops", href: "/laptops" }',
      '{ label: "Gaming", href: "/gaming" }',
      '{ label: "ASUS ROG" }',
    ].slice(0, depth);
    return `<Breadcrumb items={[
  ${items.join(',\n  ')}
]} />`;
  },
};

export default story;
