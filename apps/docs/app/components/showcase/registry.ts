import type { ShowcaseEntry } from './types.js';

/** All showcase entries — add new stories here */
export const showcaseEntries: ShowcaseEntry[] = [
  {
    slug: 'button',
    name: 'Button',
    category: 'component',
    loader: () => import('../../showcase/button.showcase.js'),
  },
  {
    slug: 'badge',
    name: 'Badge',
    category: 'component',
    loader: () => import('../../showcase/badge.showcase.js'),
  },
  {
    slug: 'card',
    name: 'Card',
    category: 'component',
    loader: () => import('../../showcase/card.showcase.js'),
  },
  {
    slug: 'input',
    name: 'Input',
    category: 'component',
    loader: () => import('../../showcase/input.showcase.js'),
  },
  {
    slug: 'stat',
    name: 'Stat',
    category: 'component',
    loader: () => import('../../showcase/stat.showcase.js'),
  },
  {
    slug: 'dialog',
    name: 'Dialog',
    category: 'component',
    loader: () => import('../../showcase/dialog.showcase.js'),
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
