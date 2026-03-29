import {
  IconAlertCircle,
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconCheckCircle,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconClose,
  IconCode,
  IconCopy,
  IconDownload,
  IconEdit,
  IconExternalLink,
  IconEye,
  IconEyeOff,
  IconFilter,
  IconGlobe,
  IconHeart,
  IconInfo,
  IconLoading,
  IconLock,
  IconLogOut,
  IconMenu,
  IconMinus,
  IconMonitor,
  IconMoon,
  IconMoreHorizontal,
  IconMoreVertical,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSettings,
  IconStar,
  IconSun,
  IconTerminal,
  IconTrash,
  IconUnlock,
  IconUpload,
  IconUser,
  IconUsers,
  IconXCircle,
} from '@revealui/presentation/server';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const allIcons = [
  { name: 'ChevronDown', Icon: IconChevronDown, group: 'Navigation' },
  { name: 'ChevronUp', Icon: IconChevronUp, group: 'Navigation' },
  { name: 'ChevronLeft', Icon: IconChevronLeft, group: 'Navigation' },
  { name: 'ChevronRight', Icon: IconChevronRight, group: 'Navigation' },
  { name: 'ArrowLeft', Icon: IconArrowLeft, group: 'Navigation' },
  { name: 'ArrowRight', Icon: IconArrowRight, group: 'Navigation' },
  { name: 'Close', Icon: IconClose, group: 'Interface' },
  { name: 'Menu', Icon: IconMenu, group: 'Interface' },
  { name: 'Search', Icon: IconSearch, group: 'Interface' },
  { name: 'Plus', Icon: IconPlus, group: 'Interface' },
  { name: 'Minus', Icon: IconMinus, group: 'Interface' },
  { name: 'MoreHorizontal', Icon: IconMoreHorizontal, group: 'Interface' },
  { name: 'MoreVertical', Icon: IconMoreVertical, group: 'Interface' },
  { name: 'ExternalLink', Icon: IconExternalLink, group: 'Interface' },
  { name: 'Check', Icon: IconCheck, group: 'Status' },
  { name: 'CheckCircle', Icon: IconCheckCircle, group: 'Status' },
  { name: 'AlertCircle', Icon: IconAlertCircle, group: 'Status' },
  { name: 'AlertTriangle', Icon: IconAlertTriangle, group: 'Status' },
  { name: 'Info', Icon: IconInfo, group: 'Status' },
  { name: 'XCircle', Icon: IconXCircle, group: 'Status' },
  { name: 'Copy', Icon: IconCopy, group: 'Content' },
  { name: 'Trash', Icon: IconTrash, group: 'Content' },
  { name: 'Edit', Icon: IconEdit, group: 'Content' },
  { name: 'Download', Icon: IconDownload, group: 'Content' },
  { name: 'Upload', Icon: IconUpload, group: 'Content' },
  { name: 'Filter', Icon: IconFilter, group: 'Content' },
  { name: 'User', Icon: IconUser, group: 'User' },
  { name: 'Users', Icon: IconUsers, group: 'User' },
  { name: 'LogOut', Icon: IconLogOut, group: 'User' },
  { name: 'Settings', Icon: IconSettings, group: 'User' },
  { name: 'Sun', Icon: IconSun, group: 'Theme' },
  { name: 'Moon', Icon: IconMoon, group: 'Theme' },
  { name: 'Monitor', Icon: IconMonitor, group: 'Theme' },
  { name: 'Code', Icon: IconCode, group: 'Misc' },
  { name: 'Terminal', Icon: IconTerminal, group: 'Misc' },
  { name: 'Globe', Icon: IconGlobe, group: 'Misc' },
  { name: 'Heart', Icon: IconHeart, group: 'Misc' },
  { name: 'Star', Icon: IconStar, group: 'Misc' },
  { name: 'Eye', Icon: IconEye, group: 'Misc' },
  { name: 'EyeOff', Icon: IconEyeOff, group: 'Misc' },
  { name: 'Lock', Icon: IconLock, group: 'Misc' },
  { name: 'Unlock', Icon: IconUnlock, group: 'Misc' },
  { name: 'Refresh', Icon: IconRefresh, group: 'Misc' },
  { name: 'Loading', Icon: IconLoading, group: 'Misc' },
];

const sizes = ['xs', 'sm', 'md', 'lg', 'xl'] as const;

const story: ShowcaseStory = {
  slug: 'icons',
  name: 'Icons',
  description: '44 SVG icons with 5 size presets. Stroke-based, accessible, zero dependencies.',
  category: 'component',

  controls: {
    size: {
      type: 'select',
      options: ['xs', 'sm', 'md', 'lg', 'xl'],
      default: 'md',
    },
    group: {
      type: 'select',
      options: ['All', 'Navigation', 'Interface', 'Status', 'Content', 'User', 'Theme', 'Misc'],
      default: 'All',
    },
  },

  render: (props) => {
    const size = props.size as (typeof sizes)[number];
    const group = props.group as string;
    const filtered = group === 'All' ? allIcons : allIcons.filter((i) => i.group === group);

    return (
      <div className="grid grid-cols-6 gap-4 sm:grid-cols-8">
        {filtered.map(({ name, Icon }) => (
          <div
            key={name}
            className="flex flex-col items-center gap-2 rounded-lg p-3 transition-colors hover:bg-(--rvui-color-surface-2)"
          >
            <Icon size={size} />
            <span className="text-xs text-(--rvui-color-text-secondary)">{name}</span>
          </div>
        ))}
      </div>
    );
  },

  examples: [
    {
      name: 'Size Comparison',
      render: () => (
        <div className="flex items-end gap-6">
          {sizes.map((size) => (
            <div key={size} className="flex flex-col items-center gap-2">
              <IconStar size={size} />
              <span className="text-xs font-mono text-(--rvui-color-text-secondary)">{size}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      name: 'Status Icons with Color',
      render: () => (
        <div className="flex items-center gap-4">
          <IconCheckCircle className="text-green-500" size="lg" label="Success" />
          <IconInfo className="text-blue-500" size="lg" label="Info" />
          <IconAlertTriangle className="text-yellow-500" size="lg" label="Warning" />
          <IconXCircle className="text-red-500" size="lg" label="Error" />
        </div>
      ),
    },
    {
      name: 'Icon in Button',
      render: () => (
        <div className="flex gap-3">
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg bg-(--rvui-color-primary) px-4 py-2 text-sm font-medium text-white"
          >
            <IconPlus size="sm" /> Add Item
          </button>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border border-(--rvui-color-border) px-4 py-2 text-sm font-medium"
          >
            <IconDownload size="sm" /> Export
          </button>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-2 text-sm font-medium text-red-500"
          >
            <IconTrash size="sm" /> Delete
          </button>
        </div>
      ),
    },
  ],

  code: (props) =>
    `import { IconStar } from '@revealui/presentation/server';

<IconStar size="${props.size}"${props.size === 'md' ? '' : ''} />`,
};

export default story;
