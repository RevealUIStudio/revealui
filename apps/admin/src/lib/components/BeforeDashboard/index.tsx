import Link from 'next/link';
import { SITE_NAME } from '@/lib/utils/siteBranding';
import PoweredByRevealUI from '../PoweredByRevealUI/index';
import OnboardingChecklist from './OnboardingChecklist';

interface NavLink {
  href: string;
  label: string;
  description: string;
}

const operateLinks: NavLink[] = [
  {
    href: '/agents',
    label: 'Agents',
    description: 'Manage the agents that run your business and the tools they can use.',
  },
  {
    href: '/agent-tasks',
    label: 'Agent Tasks',
    description: 'See every action your agents have taken, one task record at a time.',
  },
  {
    href: '/audit',
    label: 'Audit Trail',
    description: 'Check the receipt for every action taken on your infrastructure.',
  },
];

const systemLinks: NavLink[] = [
  {
    href: '/monitoring',
    label: 'Monitoring',
    description: 'System health and process metrics',
  },
  {
    href: '/logs',
    label: 'Logs',
    description: 'Application and audit logs',
  },
  {
    href: '/errors',
    label: 'Errors',
    description: 'Error tracking and diagnostics',
  },
  {
    href: '/webhooks',
    label: 'Webhooks',
    description: 'Webhook deliveries and event status',
  },
  {
    href: '/settings',
    label: 'Settings',
    description: 'Account, security, and preferences',
  },
];

const NavTile = ({ href, label, description, muted }: NavLink & { muted?: boolean }) => (
  <Link
    href={href}
    className={
      muted
        ? 'rounded-lg border border-zinc-800 bg-zinc-800/40 p-4 transition-colors hover:border-zinc-600 hover:bg-zinc-800'
        : 'rounded-lg border border-zinc-700 bg-zinc-800 p-4 transition-colors hover:border-zinc-500 hover:bg-zinc-750'
    }
  >
    <p className={`text-sm font-medium ${muted ? 'text-zinc-300' : 'text-white'}`}>{label}</p>
    <p className="mt-0.5 text-xs text-zinc-400">{description}</p>
  </Link>
);

const BeforeDashboard = () => {
  return (
    <div className="relative mx-auto w-full rounded-lg bg-zinc-900 p-8 shadow-md">
      <h1 className="mb-6 text-3xl font-bold text-white">{SITE_NAME} admin</h1>

      <OnboardingChecklist />

      <section className="mb-6">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-300">
          Operate
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {operateLinks.map((link) => (
            <NavTile key={link.href} {...link} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Diagnostics and configuration
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {systemLinks.map((link) => (
            <NavTile key={link.href} {...link} muted />
          ))}
        </div>
      </section>

      <PoweredByRevealUI />
    </div>
  );
};

export default BeforeDashboard;
