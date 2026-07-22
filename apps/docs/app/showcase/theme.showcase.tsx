import { Button } from '@revealui/presentation';
import { useTheme } from '@revealui/presentation/client';
import { IconMonitor, IconMoon, IconSun } from '@revealui/presentation/server';
import type { ShowcaseStory } from '@/components/showcase/types.js';

function ThemeDemo() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const themes = [
    { value: 'light' as const, label: 'Light', Icon: IconSun },
    { value: 'dark' as const, label: 'Dark', Icon: IconMoon },
    { value: 'system' as const, label: 'System', Icon: IconMonitor },
  ];

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex gap-2">
        {themes.map(({ value, label, Icon }) => (
          <Button
            key={value}
            type="button"
            appearance={theme === value ? 'solid' : 'ghost'}
            variant={theme === value ? 'brand' : 'neutral'}
            onClick={() => setTheme(value)}
            className={
              theme === value
                ? 'shadow-md'
                : 'bg-(--rvui-color-surface-2) text-(--rvui-color-text-secondary) hover:bg-(--rvui-color-surface-3)'
            }
          >
            <Icon size="sm" />
            {label}
          </Button>
        ))}
      </div>

      <div className="rounded-lg bg-(--rvui-color-surface-2) px-6 py-4 text-center">
        <p className="text-sm text-(--rvui-color-text-secondary)">
          Preference:{' '}
          <span className="font-mono font-medium text-(--rvui-color-text)">{theme}</span>
        </p>
        <p className="text-sm text-(--rvui-color-text-secondary)">
          Resolved:{' '}
          <span className="font-mono font-medium text-(--rvui-color-text)">{resolvedTheme}</span>
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { name: 'Surface', className: 'bg-(--rvui-color-surface)' },
          { name: 'Surface 2', className: 'bg-(--rvui-color-surface-2)' },
          { name: 'Surface 3', className: 'bg-(--rvui-color-surface-3)' },
          { name: 'Primary', className: 'bg-(--rvui-color-primary)' },
          { name: 'Success', className: 'bg-(--rvui-color-success)' },
          { name: 'Danger', className: 'bg-(--rvui-color-danger)' },
        ].map((swatch) => (
          <div key={swatch.name} className="flex flex-col items-center gap-1">
            <div
              className={`h-10 w-10 rounded-md border border-(--rvui-color-border) ${swatch.className}`}
            />
            <span className="text-xs text-(--rvui-color-text-secondary)">{swatch.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const story: ShowcaseStory = {
  slug: 'theme',
  name: 'Theme',
  description:
    'useTheme hook for light/dark/system theme switching with localStorage persistence and data-theme attribute.',
  category: 'hook',

  controls: {
    mode: {
      type: 'select',
      options: ['light', 'dark', 'system'],
      default: 'system',
    },
  },

  render: () => <ThemeDemo />,

  examples: [
    {
      name: 'Theme Toggle Button',
      description: 'Minimal toggle between light and dark',
      render: () => {
        function Toggle() {
          const { resolvedTheme, setTheme } = useTheme();
          return (
            <Button
              type="button"
              appearance="ghost"
              variant="neutral"
              size="icon"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className="rounded-full bg-(--rvui-color-surface-2) hover:bg-(--rvui-color-surface-3)"
              aria-label="Toggle theme"
            >
              {resolvedTheme === 'dark' ? <IconSun size="md" /> : <IconMoon size="md" />}
            </Button>
          );
        }
        return <Toggle />;
      },
    },
  ],

  code: (props: Record<string, unknown>) =>
    `const { theme, resolvedTheme, setTheme } = useTheme();

// Current: theme="${props.mode}", resolved to the active mode
<button onClick={() => setTheme('${props.mode}')}>
  Switch to ${props.mode}
</button>`,
};

export default story;
