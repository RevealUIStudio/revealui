import { useRvcBalance } from '../../hooks/use-rvc-balance';
import StatusDot from '../ui/StatusDot';

interface RvcBalanceCardProps {
  onNavigateToSettings?: () => void;
}

export default function RvcBalanceCard({ onNavigateToSettings }: RvcBalanceCardProps) {
  const { balance, loading, error, configured, refresh } = useRvcBalance();

  if (!configured) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <div className="flex items-center gap-2">
          <StatusDot status="off" size="md" />
          <h3 className="text-sm font-medium text-neutral-200">RevealCoin</h3>
        </div>
        <p className="mt-2 text-xs text-neutral-500">No wallet configured</p>
        {onNavigateToSettings && (
          <button
            type="button"
            onClick={onNavigateToSettings}
            className="mt-2 text-xs text-orange-500 hover:text-orange-400 transition-colors"
          >
            Add wallet address
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusDot status={error ? 'warn' : 'ok'} size="md" />
          <h3 className="text-sm font-medium text-neutral-200">RevealCoin</h3>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
      {error ? (
        <p className="mt-2 text-xs text-amber-400">{error}</p>
      ) : (
        <p className="mt-2 text-lg font-semibold tabular-nums text-neutral-100">
          {balance ?? '...'} <span className="text-sm font-normal text-neutral-500">RVC</span>
        </p>
      )}
      <p className="mt-1 text-xs capitalize text-neutral-500">{error ? 'error' : 'connected'}</p>
    </div>
  );
}
