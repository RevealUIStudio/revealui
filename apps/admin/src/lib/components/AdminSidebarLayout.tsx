'use client';

import {
  IconAlertCircle,
  IconCheckCircle,
  IconCode,
  IconEdit,
  IconExternalLink,
  IconGlobe,
  IconInfo,
  IconMonitor,
  IconRefresh,
  IconSettings,
  IconStar,
  IconTerminal,
  IconUpload,
  IconUsers,
} from '@revealui/presentation';
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
import type { ReactNode } from 'react';
import { FreeTierBanner } from '@/components/FreeTierBanner';
import { UpgradeDialog } from './UpgradeDialog';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  adminOnly?: boolean;
}

const iconClass = 'size-5';

const contentItems: NavItem[] = [
  {
    href: '/',
    label: 'Dashboard',
    icon: <IconMonitor data-slot="icon" className={iconClass} aria-hidden="true" />,
  },
  {
    href: '/chat',
    label: 'Chat',
    icon: <IconGlobe data-slot="icon" className={iconClass} aria-hidden="true" />,
  },
  {
    href: '/marketplace',
    label: 'Marketplace',
    icon: <IconStar data-slot="icon" className={iconClass} aria-hidden="true" />,
  },
  {
    href: '/edit-sessions',
    label: 'Edit sessions',
    icon: <IconEdit data-slot="icon" className={iconClass} aria-hidden="true" />,
  },
];

const aiItems: NavItem[] = [
  {
    href: '/agents',
    label: 'Agents',
    icon: <IconUsers data-slot="icon" className={iconClass} aria-hidden="true" />,
  },
  {
    href: '/agent-tasks',
    label: 'Agent Tasks',
    icon: <IconTerminal data-slot="icon" className={iconClass} aria-hidden="true" />,
  },
];

const operationsItems: NavItem[] = [
  {
    href: '/monitoring',
    label: 'Monitoring',
    icon: <IconInfo data-slot="icon" className={iconClass} aria-hidden="true" />,
  },
  {
    href: '/revenue',
    label: 'Revenue',
    icon: <IconUpload data-slot="icon" className={iconClass} aria-hidden="true" />,
  },
  {
    href: '/logs',
    label: 'Logs',
    icon: <IconCode data-slot="icon" className={iconClass} aria-hidden="true" />,
  },
  {
    href: '/errors',
    label: 'Errors',
    icon: <IconAlertCircle data-slot="icon" className={iconClass} aria-hidden="true" />,
  },
  {
    href: '/audit',
    label: 'Audit Trail',
    icon: <IconCheckCircle data-slot="icon" className={iconClass} aria-hidden="true" />,
  },
  {
    href: '/webhooks',
    label: 'Webhooks',
    icon: <IconExternalLink data-slot="icon" className={iconClass} aria-hidden="true" />,
  },
  {
    href: '/jobs',
    label: 'Jobs',
    icon: <IconRefresh data-slot="icon" className={iconClass} aria-hidden="true" />,
  },
  {
    href: '/refunds',
    label: 'Refunds',
    icon: <IconRefresh data-slot="icon" className={iconClass} aria-hidden="true" />,
  },
];

const bottomItems: NavItem[] = [
  {
    href: '/upgrade',
    label: 'Upgrade',
    icon: <IconStar data-slot="icon" className={iconClass} aria-hidden="true" />,
  },
  {
    href: '/settings',
    label: 'Settings',
    adminOnly: true,
    icon: <IconSettings data-slot="icon" className={iconClass} aria-hidden="true" />,
  },
];

function AdminSidebarContent({ siteName, isAdmin }: { siteName: string; isAdmin: boolean }) {
  const pathname = usePathname();

  const isCurrent = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const visibleBottomItems = isAdmin ? bottomItems : bottomItems.filter((item) => !item.adminOnly);

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarSection>
          <SidebarItem href="/" current={isCurrent('/')}>
            <span className="text-lg font-bold text-foreground">{siteName}</span>
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
          {visibleBottomItems.map((item) => (
            <SidebarItem key={item.href} href={item.href} current={isCurrent(item.href)}>
              {item.icon}
              <SidebarLabel>{item.label}</SidebarLabel>
            </SidebarItem>
          ))}
        </SidebarSection>
      </SidebarBody>
      <SidebarFooter>
        <p className="text-xs text-muted-foreground">{siteName} Admin</p>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AdminSidebarLayout({
  children,
  siteName = 'RevealUI',
  isFleetMode = false,
  isAdmin = true,
}: {
  children: React.ReactNode;
  siteName?: string;
  isFleetMode?: boolean;
  isAdmin?: boolean;
}) {
  return (
    <SidebarLayout
      navbar={<span />}
      sidebar={<AdminSidebarContent siteName={siteName} isAdmin={isAdmin} />}
    >
      {isFleetMode ? null : <FreeTierBanner />}
      {children}
      {isFleetMode ? null : <UpgradeDialog />}
    </SidebarLayout>
  );
}
