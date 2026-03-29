import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const sampleData = [
  { name: 'Button', category: 'Interactive', variants: 7, status: 'Stable' },
  { name: 'Badge', category: 'Display', variants: 18, status: 'Stable' },
  { name: 'Dialog', category: 'Overlay', variants: 9, status: 'Stable' },
  { name: 'Tabs', category: 'Navigation', variants: 1, status: 'Stable' },
  { name: 'Toast', category: 'Feedback', variants: 5, status: 'Beta' },
];

const story: ShowcaseStory = {
  slug: 'table',
  name: 'Table',
  description:
    'Data table with bleed, dense, grid, and striped variants. Supports clickable rows via href prop.',
  category: 'component',

  controls: {
    bleed: { type: 'boolean', default: false },
    dense: { type: 'boolean', default: false },
    grid: { type: 'boolean', default: false },
    striped: { type: 'boolean', default: false },
  },

  render: (props) => (
    <Table
      bleed={props.bleed as boolean}
      dense={props.dense as boolean}
      grid={props.grid as boolean}
      striped={props.striped as boolean}
    >
      <TableHead>
        <TableRow>
          <TableHeader>Component</TableHeader>
          <TableHeader>Category</TableHeader>
          <TableHeader>Variants</TableHeader>
          <TableHeader>Status</TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
        {sampleData.map((row) => (
          <TableRow key={row.name}>
            <TableCell className="font-medium">{row.name}</TableCell>
            <TableCell>{row.category}</TableCell>
            <TableCell>{row.variants}</TableCell>
            <TableCell>{row.status}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),

  examples: [
    {
      name: 'Dense + Striped',
      render: () => (
        <Table dense striped>
          <TableHead>
            <TableRow>
              <TableHeader>Package</TableHeader>
              <TableHeader>Version</TableHeader>
              <TableHeader>License</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {[
              { pkg: '@revealui/core', ver: '0.4.0', lic: 'MIT' },
              { pkg: '@revealui/db', ver: '0.3.2', lic: 'MIT' },
              { pkg: '@revealui/auth', ver: '0.3.2', lic: 'MIT' },
              { pkg: '@revealui/ai', ver: '0.3.2', lic: 'Commercial' },
            ].map((row) => (
              <TableRow key={row.pkg}>
                <TableCell className="font-mono text-xs">{row.pkg}</TableCell>
                <TableCell>{row.ver}</TableCell>
                <TableCell>{row.lic}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ),
    },
    {
      name: 'Grid Layout',
      render: () => (
        <Table grid>
          <TableHead>
            <TableRow>
              <TableHeader>Tier</TableHeader>
              <TableHeader>Sites</TableHeader>
              <TableHeader>Users</TableHeader>
              <TableHeader>Rate Limit</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {[
              { tier: 'Free', sites: '1', users: '3', rate: '200/min' },
              { tier: 'Pro', sites: '5', users: '25', rate: '300/min' },
              { tier: 'Max', sites: '15', users: '100', rate: '600/min' },
              { tier: 'Forge', sites: 'Unlimited', users: 'Unlimited', rate: 'Unlimited' },
            ].map((row) => (
              <TableRow key={row.tier}>
                <TableCell className="font-medium">{row.tier}</TableCell>
                <TableCell>{row.sites}</TableCell>
                <TableCell>{row.users}</TableCell>
                <TableCell>{row.rate}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ),
    },
  ],

  code: (props) => {
    const attrs: string[] = [];
    if (props.bleed) attrs.push('bleed');
    if (props.dense) attrs.push('dense');
    if (props.grid) attrs.push('grid');
    if (props.striped) attrs.push('striped');
    const attrStr = attrs.length ? ` ${attrs.join(' ')}` : '';
    return `<Table${attrStr}>
  <TableHead>
    <TableRow>
      <TableHeader>Name</TableHeader>
      <TableHeader>Value</TableHeader>
    </TableRow>
  </TableHead>
  <TableBody>
    <TableRow>
      <TableCell>Row 1</TableCell>
      <TableCell>Value 1</TableCell>
    </TableRow>
  </TableBody>
</Table>`;
  },
};

export default story;
