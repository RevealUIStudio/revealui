'use client';

import { useSignOut } from '@revealui/auth/react';
import {
  Button,
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
import { useLicense } from '@/lib/providers/LicenseProvider';
import { shouldShowUpgradeNavItem } from './should-show-upgrade-nav';
import { UpgradeDialog } from './UpgradeDialog';
import { WeeklyUsageChrome } from './WeeklyUsageChrome';

export { shouldShowUpgradeNavItem } from './should-show-upgrade-nav';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  adminOnly?: boolean;
  /** When true, only render if the account still has a higher paid tier to buy. */
  upgradeOnly?: boolean;
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
    label: 'Marketplace (preview)',
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
    href: '/margin',
    label: 'Margin',
    adminOnly: true,
    icon: <IconInfo data-slot="icon" className={iconClass} aria-hidden="true" />,
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
    upgradeOnly: true,
    icon: <IconStar data-slot="icon" className={iconClass} aria-hidden="true" />,
  },
  {
    href: '/settings',
    label: 'Settings',
    adminOnly: true,
    icon: <IconSettings data-slot="icon" className={iconClass} aria-hidden="true" />,
  },
];

function SidebarSignOut({ siteName }: { siteName: string }) {
  const { signOut, isLoading } = useSignOut();

  return (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <p className="min-w-0 truncate text-xs text-muted-foreground">{siteName} Admin</p>
      <Button
        type="button"
        variant="neutral"
        appearance="ghost"
        size="sm"
        className="shrink-0"
        disabled={isLoading}
        onClick={() => {
          void signOut().catch(() => {
            window.location.href = '/login';
          });
        }}
      >
        {isLoading ? 'Signing out...' : 'Sign out'}
      </Button>
    </div>
  );
}

function AdminSidebarContent({
  siteName,
  isAdmin,
  isFleetMode,
}: {
  siteName: string;
  isAdmin: boolean;
  isFleetMode: boolean;
}) {
  const pathname = usePathname();
  const { tier, isLoading, resolveError } = useLicense();

  const isCurrent = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const showUpgrade = shouldShowUpgradeNavItem(tier, {
    isFleetMode,
    isLoading,
    resolveError,
  });

  const visibleBottomItems = bottomItems.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.upgradeOnly && !showUpgrade) return false;
    return true;
  });

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarSection>
          <SidebarItem href="/" current={isCurrent('/')}>
            <span className="text-lg font-bold text-foreground">{siteName}</span>
          </SidebarItem>
          <WeeklyUsageChrome />
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
        <SidebarSignOut siteName={siteName} />
      </SidebarFooter>
    </Sidebar>
  );
}

export function AdminSidebarLayout({
  children,
  siteName = 'RevealUI',
  isFleetMode = false,
  isHosted = false,
  isAdmin = true,
}: {
  children: React.ReactNode;
  siteName?: string;
  isFleetMode?: boolean;
  isHosted?: boolean;
  isAdmin?: boolean;
}) {
  return (
    <SidebarLayout
      navbar={<WeeklyUsageChrome compact />}
      sidebar={
        <AdminSidebarContent siteName={siteName} isAdmin={isAdmin} isFleetMode={isFleetMode} />
      }
    >
      {isFleetMode ? null : <FreeTierBanner isHosted={isHosted} />}
      {children}
      {isFleetMode ? null : <UpgradeDialog />}
    </SidebarLayout>
  );
}
