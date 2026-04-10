import { useEffect, useRef, useState } from 'react';
import { getConfig } from '../../lib/config';
import { healthCheck } from '../../lib/deploy';
import type { StudioConfig } from '../../types';
import Button from '../ui/Button';
import PanelHeader from '../ui/PanelHeader';

type ServiceStatus = 'healthy' | 'degraded' | 'down' | 'checking';

interface ServiceState {
  label: string;
  url: string;
  status: ServiceStatus;
}

/** Health check interval in ms (60 seconds) */
const HEALTH_CHECK_INTERVAL_MS = 60_000;

function resolveStatus(code: number): ServiceStatus {
  if (code >= 200 && code < 300) return 'healthy';
  if (code >= 300 && code < 500) return 'degraded';
  return 'down';
}

async function runHealthChecks(
  current: ServiceState[],
  setServices: React.Dispatch<React.SetStateAction<ServiceState[]>>,
  setRefreshing: React.Dispatch<React.SetStateAction<boolean>>,
): Promise<void> {
  if (current.length === 0) return;

  setRefreshing(true);
  setServices((prev) => prev.map((s) => ({ ...s, status: 'checking' as const })));

  const results = await Promise.allSettled(
    current.map((s) => healthCheck(`${s.url}/health/ready`)),
  );

  setServices((prev) =>
    prev.map((s, i) => {
      const result = results[i];
      if (result.status === 'fulfilled') {
        return { ...s, status: resolveStatus(result.value) };
      }
      return { ...s, status: 'down' as const };
    }),
  );

  setRefreshing(false);
}

export default function DeployDashboard() {
  const [config, setConfig] = useState<StudioConfig | null>(null);
  const [services, setServices] = useState<ServiceState[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const servicesRef = useRef(services);
  servicesRef.current = services;

  useEffect(() => {
    void getConfig().then((cfg) => {
      setConfig(cfg);
      const domain = cfg.deploy?.domain;
      if (domain) {
        const initial: ServiceState[] = [
          { label: 'API', url: `https://api.${domain}`, status: 'checking' },
          { label: 'Admin', url: `https://admin.${domain}`, status: 'checking' },
          { label: 'Marketing', url: `https://${domain}`, status: 'checking' },
        ];
        setServices(initial);
        // Run initial health check
        void runHealthChecks(initial, setServices, setRefreshing);
      }
    });
  }, []);

  // Periodic health check every 60 seconds
  useEffect(() => {
    if (services.length === 0) return;

    const interval = setInterval(() => {
      void runHealthChecks(servicesRef.current, setServices, setRefreshing);
    }, HEALTH_CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [services.length]);

  function handleRefresh() {
    void runHealthChecks(services, setServices, setRefreshing);
  }

  const domain = config?.deploy?.domain;

  return (
    <div className="flex flex-col gap-6">
      <PanelHeader
        title="Deploy Dashboard"
        action={
          <Button variant="secondary" onClick={handleRefresh} loading={refreshing}>
            Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {services.map((service) => (
          <HealthCard key={service.label} service={service} />
        ))}
      </div>

      {domain && (
        <div className="rounded-md border border-neutral-700 bg-neutral-900/50 p-4">
          <p className="mb-3 text-xs font-medium text-neutral-400">Quick Links</p>
          <div className="flex flex-col gap-2">
            <QuickLink label="Admin Dashboard" url={`https://admin.${domain}/admin`} />
            <QuickLink label="API Docs" url={`https://api.${domain}/docs`} />
            <QuickLink label="Marketing Site" url={`https://${domain}`} />
          </div>
        </div>
      )}
    </div>
  );
}

function HealthCard({ service }: { service: ServiceState }) {
  const dotClasses: Record<ServiceStatus, string> = {
    healthy: 'bg-green-500',
    degraded: 'bg-yellow-500',
    down: 'bg-red-500',
    checking: 'bg-neutral-500 animate-pulse',
  };

  const statusLabels: Record<ServiceStatus, string> = {
    healthy: 'Healthy',
    degraded: 'Degraded',
    down: 'Down',
    checking: 'Checking...',
  };

  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={`inline-block size-2.5 rounded-full ${dotClasses[service.status]}`} />
        <span className="text-sm font-medium text-neutral-200">{service.label}</span>
      </div>
      <p className="text-xs text-neutral-500">{statusLabels[service.status]}</p>
      <p className="mt-1 text-xs font-mono text-neutral-400 truncate">{service.url}</p>
    </div>
  );
}

function QuickLink({ label, url }: { label: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 text-sm text-orange-400 hover:text-orange-300 transition-colors"
    >
      <span>{'\u2192'}</span>
      <span>{label}</span>
      <span className="font-mono text-xs text-neutral-500">{url}</span>
    </a>
  );
}
