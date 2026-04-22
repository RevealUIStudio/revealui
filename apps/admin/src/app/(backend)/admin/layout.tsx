'use client';

import {
  Sidebar,
  SidebarBody,
  SidebarFooter,
  SidebarHeader,
  SidebarHeading,
  SidebarItem,
  SidebarLabel,
  SidebarLayout,
  SidebarSection,
  SidebarSpacer,
} from '@revealui/presentation/client';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

function NavIcon({ d }: { d: string }) {
  return (
    <svg data-slot="icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d={d} clipRule="evenodd" />
    </svg>
  );
}

const contentItems: NavItem[] = [
  {
    href: '/admin',
    label: 'Dashboard',
    icon: (
      <NavIcon d="M10.707 2.293a1 1 0 0 0-1.414 0l-7 7a1 1 0 0 0 1.414 1.414L4 10.414V17a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-6.586l.293.293a1 1 0 0 0 1.414-1.414l-7-7Z" />
    ),
  },
  {
    href: '/admin/chat',
    label: 'Chat',
    icon: (
      <NavIcon d="M3.43 2.524A41.29 41.29 0 0 1 10 2c2.236 0 4.43.18 6.57.524 1.437.231 2.43 1.49 2.43 2.902v5.148c0 1.413-.993 2.67-2.43 2.902a41.202 41.202 0 0 1-3.55.414c-.28.02-.521.18-.643.413l-1.712 3.293a.75.75 0 0 1-1.33 0l-1.713-3.293a.783.783 0 0 0-.642-.413 41.202 41.202 0 0 1-3.551-.414C1.993 13.245 1 11.986 1 10.574V5.426c0-1.413.993-2.67 2.43-2.902Z" />
    ),
  },
  {
    href: '/admin/marketplace',
    label: 'Marketplace',
    icon: (
      <NavIcon d="M4 4a2 2 0 0 0-2 2v1h16V6a2 2 0 0 0-2-2H4ZM18 9H2v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9ZM4 13a1 1 0 0 1 1-1h1a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1Zm5-1a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2H9Z" />
    ),
  },
];

const aiItems: NavItem[] = [
  {
    href: '/admin/agents',
    label: 'Agents',
    icon: (
      <NavIcon d="M13.024 9.25c.47 0 .827-.433.637-.863a4 4 0 0 0-7.322 0c-.19.43.168.863.637.863h6.048ZM7.5 6.5a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0ZM3 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1H3Zm8.5.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5Zm.5-3.5a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5Z" />
    ),
  },
  {
    href: '/admin/agent-tasks',
    label: 'Agent Tasks',
    icon: (
      <NavIcon d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 0 1 .628.74v2.288a2.25 2.25 0 0 1-.659 1.59l-4.682 4.683a2.25 2.25 0 0 0-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 0 1 8 18.25v-5.757a2.25 2.25 0 0 0-.659-1.591L2.659 6.22A2.25 2.25 0 0 1 2 4.629V2.34a.75.75 0 0 1 .628-.74Z" />
    ),
  },
];

const operationsItems: NavItem[] = [
  {
    href: '/admin/monitoring',
    label: 'Monitoring',
    icon: (
      <NavIcon d="M12.577 4.878a.75.75 0 0 1 .919-.53l4.78 1.281a.75.75 0 0 1 .531.919l-1.281 4.78a.75.75 0 0 1-1.449-.388l.81-3.022a19.407 19.407 0 0 0-5.594 5.203.75.75 0 0 1-1.139.093L7 10.06l-4.72 4.72a.75.75 0 0 1-1.06-1.06l5.25-5.25a.75.75 0 0 1 1.06 0l3.082 3.083a20.903 20.903 0 0 1 5.495-4.876l-3.042.815a.75.75 0 0 1-.388-1.449Z" />
    ),
  },
  {
    href: '/admin/revenue',
    label: 'Revenue',
    icon: (
      <NavIcon d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.798 7.45c.512-.67 1.135-.95 1.702-.95s1.19.28 1.702.95a.75.75 0 0 0 1.192-.91C12.637 5.55 11.596 5 10.5 5s-2.137.55-2.894 1.54A5.205 5.205 0 0 0 6.5 10c0 1.519.474 2.77 1.106 3.46.757.99 1.798 1.54 2.894 1.54s2.137-.55 2.894-1.54a.75.75 0 0 0-1.192-.91c-.512.67-1.135.95-1.702.95s-1.19-.28-1.702-.95A3.505 3.505 0 0 1 8 10c0-.97.266-1.86.798-2.55Z" />
    ),
  },
  {
    href: '/admin/logs',
    label: 'Logs',
    icon: (
      <NavIcon d="M4.5 2A1.5 1.5 0 0 0 3 3.5v13A1.5 1.5 0 0 0 4.5 18h11a1.5 1.5 0 0 0 1.5-1.5V7.621a1.5 1.5 0 0 0-.44-1.06l-4.12-4.122A1.5 1.5 0 0 0 11.378 2H4.5ZM7 11a.75.75 0 0 0 0 1.5h6A.75.75 0 0 0 13 11H7Zm0 3a.75.75 0 0 0 0 1.5h6A.75.75 0 0 0 13 14H7Zm.75-6.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 0 1.5h-3a.75.75 0 0 1-.75-.75Z" />
    ),
  },
  {
    href: '/admin/errors',
    label: 'Errors',
    icon: (
      <NavIcon d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
    ),
  },
  {
    href: '/admin/audit',
    label: 'Audit Trail',
    icon: (
      <NavIcon d="M10 1a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 1ZM5.05 3.636a.75.75 0 0 1 0 1.06l-1.06 1.06a.75.75 0 0 1-1.06-1.06l1.06-1.06a.75.75 0 0 1 1.06 0ZM14.95 3.636a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 0 1-1.06 1.06l-1.06-1.06a.75.75 0 0 1 0-1.06ZM10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm-6.25 3a.75.75 0 0 1-.75-.75h-1.5a.75.75 0 0 1 0 1.5H3a.75.75 0 0 1 .75-.75Zm14 0a.75.75 0 0 1-.75-.75h-1.5a.75.75 0 0 1 0 1.5H17a.75.75 0 0 1 .75-.75Zm-11.7 4.95a.75.75 0 0 1 0 1.06l-1.06 1.06a.75.75 0 0 1-1.06-1.06l1.06-1.06a.75.75 0 0 1 1.06 0Zm9.9 0a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 0 1-1.06 1.06l-1.06-1.06a.75.75 0 0 1 0-1.06ZM10 15a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 15Z" />
    ),
  },
  {
    href: '/admin/webhooks',
    label: 'Webhooks',
    icon: (
      <NavIcon d="M4.632 3.533A2 2 0 0 1 6.577 2h6.846a2 2 0 0 1 1.945 1.533l1.976 8.234A3.489 3.489 0 0 0 16 11.5H4c-.476 0-.93.095-1.344.267l1.976-8.234ZM4 13a2 2 0 1 0 0 4h12a2 2 0 1 0 0-4H4Zm11.5 2a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0Zm-2 0a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0Z" />
    ),
  },
  {
    href: '/admin/jobs',
    label: 'Jobs',
    icon: (
      <NavIcon d="M10 3.5a.75.75 0 0 1 .75.75v1.5h3.25a.75.75 0 0 1 .75.75v1a.75.75 0 0 1-.75.75H5.75A.75.75 0 0 1 5 7.5v-1a.75.75 0 0 1 .75-.75H9v-1.5a.75.75 0 0 1 .75-.75h.25ZM3.5 9.5h13a.5.5 0 0 1 .5.5v6a2 2 0 0 1-2 2h-10a2 2 0 0 1-2-2v-6a.5.5 0 0 1 .5-.5ZM10 12a.75.75 0 0 0-.75.75v1.5a.75.75 0 0 0 1.5 0v-1.5A.75.75 0 0 0 10 12Z" />
    ),
  },
  {
    href: '/admin/refunds',
    label: 'Refunds',
    icon: (
      <NavIcon d="M13.024 2a.75.75 0 0 1 .743.648l.034.402c.164 1.922.407 3.477 1.712 3.95.14.051.27.116.386.196A.75.75 0 0 1 15.5 8H4.5a.75.75 0 0 1-.399-.804c.116-.08.246-.145.386-.196 1.305-.473 1.548-2.028 1.712-3.95L6.233 2.648A.75.75 0 0 1 6.976 2h6.048ZM3.5 9.5a1 1 0 0 0-1 1v.5a4 4 0 0 0 4 4h.528a1.5 1.5 0 0 1 .972.358l1.5 1.273 1.5-1.273A1.5 1.5 0 0 1 12 15h.528a4 4 0 0 0 4-4v-.5a1 1 0 0 0-1-1h-12Z" />
    ),
  },
];

const bottomItems: NavItem[] = [
  {
    href: '/admin/upgrade',
    label: 'Upgrade',
    icon: (
      <NavIcon d="M10.75 10.818v2.614A3.13 3.13 0 0 0 11.888 17a3.13 3.13 0 0 0 2.529-1.279l2.387-3.29a.25.25 0 0 0-.203-.393h-2.35l1.108-4.432a.25.25 0 0 0-.44-.205L10.75 10.818ZM7.556 5.088a.25.25 0 0 0-.44.205l1.109 4.432H5.874a.25.25 0 0 0-.203.393l2.387 3.29A3.13 3.13 0 0 0 10.587 17c.403-.5.652-1.134.652-1.825v-4.357L7.556 5.088Z" />
    ),
  },
  {
    href: '/admin/settings',
    label: 'Settings',
    icon: (
      <NavIcon d="M8 10a2 2 0 1 1 4 0 2 2 0 0 1-4 0Zm2-5.5A1.5 1.5 0 0 1 11.5 6c0 .587.268 1.089.689 1.24a4.98 4.98 0 0 1 1.271.733c.403.29.94.284 1.365.026A1.5 1.5 0 0 1 17.5 9.5c0 .587-.268 1.089-.689 1.24a4.98 4.98 0 0 0 0 2.52c.421.151.689.653.689 1.24a1.5 1.5 0 0 1-2.675 1.001c-.425-.258-.962-.264-1.365.026a4.98 4.98 0 0 1-1.271.733c-.421.151-.689.653-.689 1.24A1.5 1.5 0 0 1 10 19.5a1.5 1.5 0 0 1-1.5-1.5c0-.587-.268-1.089-.689-1.24a4.98 4.98 0 0 1-1.271-.733c-.403-.29-.94-.284-1.365-.026A1.5 1.5 0 0 1 2.5 14.5c0-.587.268-1.089.689-1.24a4.98 4.98 0 0 0 0-2.52C2.768 10.589 2.5 10.087 2.5 9.5A1.5 1.5 0 0 1 5.175 8.499c.425.258.962.264 1.365-.026a4.98 4.98 0 0 1 1.271-.733C8.232 7.589 8.5 7.087 8.5 6.5A1.5 1.5 0 0 1 10 5Z" />
    ),
  },
];

function AdminSidebarContent() {
  const pathname = usePathname();

  const isCurrent = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarSection>
          <SidebarItem href="/admin" current={isCurrent('/admin')}>
            <span className="text-lg font-bold text-white">RevealUI</span>
          </SidebarItem>
        </SidebarSection>
      </SidebarHeader>
      <SidebarBody>
        <SidebarSection>
          <SidebarHeading>Content</SidebarHeading>
          {contentItems.map((item) => (
            <SidebarItem key={item.href} href={item.href} current={isCurrent(item.href)}>
              {item.icon}
              <SidebarLabel>{item.label}</SidebarLabel>
            </SidebarItem>
          ))}
        </SidebarSection>
        <SidebarSection>
          <SidebarHeading>AI</SidebarHeading>
          {aiItems.map((item) => (
            <SidebarItem key={item.href} href={item.href} current={isCurrent(item.href)}>
              {item.icon}
              <SidebarLabel>{item.label}</SidebarLabel>
            </SidebarItem>
          ))}
        </SidebarSection>
        <SidebarSection>
          <SidebarHeading>Operations</SidebarHeading>
          {operationsItems.map((item) => (
            <SidebarItem key={item.href} href={item.href} current={isCurrent(item.href)}>
              {item.icon}
              <SidebarLabel>{item.label}</SidebarLabel>
            </SidebarItem>
          ))}
        </SidebarSection>
        <SidebarSpacer />
        <SidebarSection>
          {bottomItems.map((item) => (
            <SidebarItem key={item.href} href={item.href} current={isCurrent(item.href)}>
              {item.icon}
              <SidebarLabel>{item.label}</SidebarLabel>
            </SidebarItem>
          ))}
        </SidebarSection>
      </SidebarBody>
      <SidebarFooter>
        <p className="text-xs text-zinc-500">RevealUI Admin</p>
      </SidebarFooter>
    </Sidebar>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarLayout navbar={<span />} sidebar={<AdminSidebarContent />}>
      {children}
    </SidebarLayout>
  );
}
