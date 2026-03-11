import StatusDot from '../ui/StatusDot';

interface ServiceCardProps {
  title: string;
  status: 'running' | 'stopped' | 'degraded';
  detail: string;
}

const statusMap = {
  running: 'ok',
  stopped: 'off',
  degraded: 'warn',
} as const;

export default function ServiceCard({ title, status, detail }: ServiceCardProps) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex items-center gap-2">
        <StatusDot status={statusMap[status]} size="md" />
        <h3 className="text-sm font-medium text-neutral-200">{title}</h3>
      </div>
      <p className="mt-2 text-xs text-neutral-400">{detail}</p>
      <p className="mt-1 text-xs capitalize text-neutral-500">{status}</p>
    </div>
  );
}
