import Link from 'next/link';
import PoweredByRevealUI from '../PoweredByRevealUI/index';
import OnboardingChecklist from './OnboardingChecklist';

const adminLinks = [
  {
    href: '/admin/agents',
    label: 'Agents',
    description: 'A2A agent cards and MCP server integrations',
  },
  {
    href: '/admin/agent-tasks',
    label: 'Agent Tasks',
    description: 'Task execution history across all AI agents',
  },
  {
    href: '/admin/monitoring',
    label: 'Monitoring',
    description: 'System health and process metrics',
  },
  {
    href: '/admin/logs',
    label: 'Logs',
    description: 'Application and audit logs',
  },
  {
    href: '/admin/errors',
    label: 'Errors',
    description: 'Error tracking and diagnostics',
  },
  {
    href: '/admin/audit',
    label: 'Audit Trail',
    description: 'Security and compliance audit log',
  },
  {
    href: '/admin/webhooks',
    label: 'Webhooks',
    description: 'Webhook deliveries and event status',
  },
  {
    href: '/admin/settings',
    label: 'Settings',
    description: 'Account, security, and preferences',
  },
];

const BeforeDashboard = () => {
  return (
    <div className="relative mx-auto w-full rounded-lg bg-zinc-900 p-8 shadow-md">
      <h1 className="mb-6 text-3xl font-bold text-white">RevealUI admin</h1>

      <OnboardingChecklist />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {adminLinks.map(({ href, label, description }) => (
          <Link
            key={href}
            href={href}
            className="rounded-lg border border-zinc-700 bg-zinc-800 p-4 transition-colors hover:border-zinc-500 hover:bg-zinc-750"
          >
            <p className="text-sm font-medium text-white">{label}</p>
            <p className="mt-0.5 text-xs text-zinc-400">{description}</p>
          </Link>
        ))}
      </div>

      <PoweredByRevealUI />
    </div>
  );
};

export default BeforeDashboard;
