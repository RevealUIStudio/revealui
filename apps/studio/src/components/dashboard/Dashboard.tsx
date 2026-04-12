import { useSettingsContext } from '../../hooks/use-settings';
import { useStatusContext } from '../../hooks/use-status';
import RvuiUpgradePanel from '../subscription/RvuiUpgradePanel';
import Button from '../ui/Button';
import ErrorAlert from '../ui/ErrorAlert';
import PanelHeader from '../ui/PanelHeader';
import HealthCard from './HealthCard';
import RvuiBalanceCard from './RvuiBalanceCard';
import ServiceCard from './ServiceCard';
import SubscriptionCard from './SubscriptionCard';
import TierBadge from './TierBadge';
import WelcomeBanner from './WelcomeBanner';

export default function Dashboard() {
  const { system, mount, loading, error, refresh } = useStatusContext();
  const { settings } = useSettingsContext();

  if (loading && !system) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      <PanelHeader
        title="Dashboard"
        action={
          <Button variant="secondary" onClick={refresh} loading={loading}>
            Refresh
          </Button>
        }
      />

      <WelcomeBanner />

      <ErrorAlert message={error} />

      {system ? (
        <div className="flex items-center gap-3">
          <TierBadge tier={system.tier} />
          <span className="text-sm text-neutral-400">
            {system.distribution} - systemd: {system.systemd_status}
          </span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ServiceCard
          title="WSL"
          status={system?.wsl_running ? 'running' : 'stopped'}
          detail={system?.distribution ?? 'Unknown'}
        />
        <ServiceCard
          title="Studio Drive"
          status={mount?.mounted ? 'running' : 'stopped'}
          detail={
            mount?.mounted
              ? `${mount.size_used ?? '?'} / ${mount.size_total ?? '?'} (${mount.use_percent ?? '?'})`
              : 'Not mounted'
          }
        />
        <ServiceCard
          title="Systemd"
          status={
            system?.systemd_status === 'running'
              ? 'running'
              : system?.systemd_status === 'degraded'
                ? 'degraded'
                : 'stopped'
          }
          detail={system?.systemd_status ?? 'Unknown'}
        />
        <RvuiBalanceCard />
        <HealthCard />
        <SubscriptionCard />
      </div>

      <RvuiUpgradePanel currentTier={system?.tier} apiUrl={settings.apiUrl} />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-7 w-32 animate-pulse rounded bg-neutral-800" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-lg bg-neutral-800/50" />
        ))}
      </div>
    </div>
  );
}
