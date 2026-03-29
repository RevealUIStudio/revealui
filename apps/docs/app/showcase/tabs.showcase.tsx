import { Tab, TabList, TabPanel, Tabs } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'tabs',
  name: 'Tabs',
  description:
    'Accessible tab interface with keyboard navigation (arrow keys, Home/End). Supports controlled and uncontrolled modes.',
  category: 'component',

  controls: {
    tabCount: {
      type: 'number',
      default: 3,
      min: 2,
      max: 6,
      step: 1,
    },
  },

  render: (props) => {
    const count = props.tabCount as number;
    const tabs = Array.from({ length: count }, (_, i) => ({
      id: `tab-${i + 1}`,
      label: `Tab ${i + 1}`,
      content: `Content for tab ${i + 1}. Each panel is lazily rendered and only shown when its tab is active.`,
    }));

    return (
      <Tabs defaultTab={tabs[0]?.id ?? 'tab-1'}>
        <TabList>
          {tabs.map((t) => (
            <Tab key={t.id} id={t.id}>
              {t.label}
            </Tab>
          ))}
        </TabList>
        {tabs.map((t) => (
          <TabPanel key={t.id} id={t.id}>
            <div className="p-4 text-sm text-zinc-600 dark:text-zinc-400">{t.content}</div>
          </TabPanel>
        ))}
      </Tabs>
    );
  },

  examples: [
    {
      name: 'Settings Pattern',
      render: () => (
        <Tabs defaultTab="general">
          <TabList>
            <Tab id="general">General</Tab>
            <Tab id="security">Security</Tab>
            <Tab id="billing">Billing</Tab>
          </TabList>
          <TabPanel id="general">
            <div className="p-4 text-sm text-zinc-600 dark:text-zinc-400">
              General account settings like name, email, and preferences.
            </div>
          </TabPanel>
          <TabPanel id="security">
            <div className="p-4 text-sm text-zinc-600 dark:text-zinc-400">
              Password, 2FA, passkeys, and session management.
            </div>
          </TabPanel>
          <TabPanel id="billing">
            <div className="p-4 text-sm text-zinc-600 dark:text-zinc-400">
              Subscription plan, payment methods, and invoices.
            </div>
          </TabPanel>
        </Tabs>
      ),
    },
    {
      name: 'Code Example Tabs',
      render: () => (
        <Tabs defaultTab="ts">
          <TabList>
            <Tab id="ts">TypeScript</Tab>
            <Tab id="bash">Bash</Tab>
          </TabList>
          <TabPanel id="ts">
            <pre className="p-4 text-sm font-mono text-zinc-600 dark:text-zinc-400">
              {`import { Button } from '@revealui/presentation/client'`}
            </pre>
          </TabPanel>
          <TabPanel id="bash">
            <pre className="p-4 text-sm font-mono text-zinc-600 dark:text-zinc-400">
              {`npx create-revealui my-app`}
            </pre>
          </TabPanel>
        </Tabs>
      ),
    },
  ],

  code: () => `<Tabs defaultTab="tab-1">
  <TabList>
    <Tab id="tab-1">Tab 1</Tab>
    <Tab id="tab-2">Tab 2</Tab>
  </TabList>
  <TabPanel id="tab-1">Content 1</TabPanel>
  <TabPanel id="tab-2">Content 2</TabPanel>
</Tabs>`,
};

export default story;
