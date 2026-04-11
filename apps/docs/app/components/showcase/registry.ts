import type { ShowcaseEntry } from './types.js';

/** All showcase entries  -  add new stories here */
export const showcaseEntries: ShowcaseEntry[] = [
  {
    slug: 'accordion',
    name: 'Accordion',
    category: 'component',
    loader: () => import('../../showcase/accordion.showcase.js'),
  },
  {
    slug: 'alert',
    name: 'Alert',
    category: 'component',
    loader: () => import('../../showcase/alert.showcase.js'),
  },
  {
    slug: 'animations',
    name: 'Animations',
    category: 'hook',
    loader: () => import('../../showcase/animations.showcase.js'),
  },
  {
    slug: 'avatar',
    name: 'Avatar',
    category: 'component',
    loader: () => import('../../showcase/avatar.showcase.js'),
  },
  {
    slug: 'avatar-group',
    name: 'Avatar Group',
    category: 'component',
    loader: () => import('../../showcase/avatar-group.showcase.js'),
  },
  {
    slug: 'badge',
    name: 'Badge',
    category: 'component',
    loader: () => import('../../showcase/badge.showcase.js'),
  },
  {
    slug: 'breadcrumb',
    name: 'Breadcrumb',
    category: 'component',
    loader: () => import('../../showcase/breadcrumb.showcase.js'),
  },
  {
    slug: 'button',
    name: 'Button',
    category: 'component',
    loader: () => import('../../showcase/button.showcase.js'),
  },
  {
    slug: 'callout',
    name: 'Callout',
    category: 'component',
    loader: () => import('../../showcase/callout.showcase.js'),
  },
  {
    slug: 'card',
    name: 'Card',
    category: 'component',
    loader: () => import('../../showcase/card.showcase.js'),
  },
  {
    slug: 'checkbox',
    name: 'Checkbox',
    category: 'component',
    loader: () => import('../../showcase/checkbox.showcase.js'),
  },
  {
    slug: 'code-block',
    name: 'Code Block',
    category: 'component',
    loader: () => import('../../showcase/code-block.showcase.js'),
  },
  {
    slug: 'combobox',
    name: 'Combobox',
    category: 'component',
    loader: () => import('../../showcase/combobox.showcase.js'),
  },
  {
    slug: 'description-list',
    name: 'Description List',
    category: 'component',
    loader: () => import('../../showcase/description-list.showcase.js'),
  },
  {
    slug: 'dialog',
    name: 'Dialog',
    category: 'component',
    loader: () => import('../../showcase/dialog.showcase.js'),
  },
  {
    slug: 'divider',
    name: 'Divider',
    category: 'component',
    loader: () => import('../../showcase/divider.showcase.js'),
  },
  {
    slug: 'drawer',
    name: 'Drawer',
    category: 'component',
    loader: () => import('../../showcase/drawer.showcase.js'),
  },
  {
    slug: 'dropdown',
    name: 'Dropdown',
    category: 'component',
    loader: () => import('../../showcase/dropdown.showcase.js'),
  },
  {
    slug: 'empty-state',
    name: 'Empty State',
    category: 'component',
    loader: () => import('../../showcase/empty-state.showcase.js'),
  },
  {
    slug: 'fieldset',
    name: 'Fieldset',
    category: 'component',
    loader: () => import('../../showcase/fieldset.showcase.js'),
  },
  {
    slug: 'heading',
    name: 'Heading',
    category: 'component',
    loader: () => import('../../showcase/heading.showcase.js'),
  },
  {
    slug: 'icons',
    name: 'Icons',
    category: 'component',
    loader: () => import('../../showcase/icons.showcase.js'),
  },
  {
    slug: 'input',
    name: 'Input',
    category: 'component',
    loader: () => import('../../showcase/input.showcase.js'),
  },
  {
    slug: 'kbd',
    name: 'Kbd',
    category: 'component',
    loader: () => import('../../showcase/kbd.showcase.js'),
  },
  {
    slug: 'link',
    name: 'Link',
    category: 'component',
    loader: () => import('../../showcase/link.showcase.js'),
  },
  {
    slug: 'listbox',
    name: 'Listbox',
    category: 'component',
    loader: () => import('../../showcase/listbox.showcase.js'),
  },
  {
    slug: 'navbar',
    name: 'Navbar',
    category: 'component',
    loader: () => import('../../showcase/navbar.showcase.js'),
  },
  {
    slug: 'pagination',
    name: 'Pagination',
    category: 'component',
    loader: () => import('../../showcase/pagination.showcase.js'),
  },
  {
    slug: 'progress',
    name: 'Progress',
    category: 'component',
    loader: () => import('../../showcase/progress.showcase.js'),
  },
  {
    slug: 'radio',
    name: 'Radio',
    category: 'component',
    loader: () => import('../../showcase/radio.showcase.js'),
  },
  {
    slug: 'rating',
    name: 'Rating',
    category: 'component',
    loader: () => import('../../showcase/rating.showcase.js'),
  },
  {
    slug: 'select',
    name: 'Select',
    category: 'component',
    loader: () => import('../../showcase/select.showcase.js'),
  },
  {
    slug: 'sidebar',
    name: 'Sidebar',
    category: 'component',
    loader: () => import('../../showcase/sidebar.showcase.js'),
  },
  {
    slug: 'skeleton',
    name: 'Skeleton',
    category: 'component',
    loader: () => import('../../showcase/skeleton.showcase.js'),
  },
  {
    slug: 'slider',
    name: 'Slider',
    category: 'component',
    loader: () => import('../../showcase/slider.showcase.js'),
  },
  {
    slug: 'stat',
    name: 'Stat',
    category: 'component',
    loader: () => import('../../showcase/stat.showcase.js'),
  },
  {
    slug: 'stepper',
    name: 'Stepper',
    category: 'component',
    loader: () => import('../../showcase/stepper.showcase.js'),
  },
  {
    slug: 'switch',
    name: 'Switch',
    category: 'component',
    loader: () => import('../../showcase/switch.showcase.js'),
  },
  {
    slug: 'table',
    name: 'Table',
    category: 'component',
    loader: () => import('../../showcase/table.showcase.js'),
  },
  {
    slug: 'tabs',
    name: 'Tabs',
    category: 'component',
    loader: () => import('../../showcase/tabs.showcase.js'),
  },
  {
    slug: 'text',
    name: 'Text',
    category: 'component',
    loader: () => import('../../showcase/text.showcase.js'),
  },
  {
    slug: 'textarea',
    name: 'Textarea',
    category: 'component',
    loader: () => import('../../showcase/textarea.showcase.js'),
  },
  {
    slug: 'theme',
    name: 'Theme',
    category: 'hook',
    loader: () => import('../../showcase/theme.showcase.js'),
  },
  {
    slug: 'timeline',
    name: 'Timeline',
    category: 'component',
    loader: () => import('../../showcase/timeline.showcase.js'),
  },
  {
    slug: 'toast',
    name: 'Toast',
    category: 'component',
    loader: () => import('../../showcase/toast.showcase.js'),
  },
  {
    slug: 'tooltip',
    name: 'Tooltip',
    category: 'component',
    loader: () => import('../../showcase/tooltip.showcase.js'),
  },
];

/** Sidebar nav items derived from registry */
export function getShowcaseNavItems(): Array<{ label: string; path: string }> {
  const items: Array<{ label: string; path: string }> = [
    { label: 'Overview', path: '/showcase' },
    { label: 'Design Tokens', path: '/showcase/tokens' },
  ];

  const grouped = new Map<string, ShowcaseEntry[]>();
  for (const entry of showcaseEntries) {
    const group = grouped.get(entry.category) ?? [];
    group.push(entry);
    grouped.set(entry.category, group);
  }

  for (const [, entries] of grouped) {
    for (const entry of entries) {
      items.push({ label: entry.name, path: `/showcase/${entry.slug}` });
    }
  }

  return items;
}
