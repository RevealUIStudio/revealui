import { useEffect, useState } from 'react';
import { formatNumber } from '@/lib/constants';
import {
  calculateVestingState,
  VESTING_SCHEDULES,
  type VestingState,
  type VestingStatus,
} from '@/lib/vesting';

const STATUS_STYLES: Record<VestingStatus, { label: string; badge: string; bar: string }> = {
  cliff: {
    label: 'Cliff Period',
    badge: 'bg-amber-100 text-amber-700',
    bar: 'bg-gray-300',
  },
  locked: {
    label: 'Locked',
    badge: 'bg-red-100 text-red-700',
    bar: 'bg-gray-300',
  },
  vesting: {
    label: 'Vesting',
    badge: 'bg-emerald-100 text-emerald-700',
    bar: 'bg-emerald-500',
  },
  complete: {
    label: 'Fully Vested',
    badge: 'bg-violet-100 text-violet-700',
    bar: 'bg-violet-500',
  },
};

function VestingCard({ state }: { state: VestingState }) {
  const {
    schedule,
    status,
    percentVested,
    amountVested,
    amountLocked,
    nextMilestone,
    daysUntilNextMilestone,
  } = state;
  const style = STATUS_STYLES[status];

  return (
    <div className="rounded-xl bg-gray-50 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-950">{schedule.name}</h3>
          <p className="mt-1 text-xs text-gray-500">{schedule.description}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${style.badge}`}>
          {style.label}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs text-gray-500">
          <span>{percentVested.toFixed(1)}% vested</span>
          <span>{schedule.totalDuration}</span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-200">
          <div
            className={`h-2 rounded-full transition-all duration-700 ${style.bar}`}
            style={{ width: `${Math.max(percentVested, 0.5)}%` }}
          />
        </div>
      </div>

      {/* Amount breakdown */}
      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs text-gray-400">Vested</p>
          <p className="font-mono text-emerald-600">{formatNumber(amountVested)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Locked</p>
          <p className="font-mono text-gray-600">{formatNumber(amountLocked)}</p>
        </div>
      </div>

      {/* Next milestone */}
      {nextMilestone && daysUntilNextMilestone !== null && (
        <div className="mt-4 rounded-lg bg-white px-3 py-2 ring-1 ring-gray-950/5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">
              Next: <span className="font-medium text-gray-700">{nextMilestone.label}</span>
            </span>
            <span className="font-mono text-violet-600">{daysUntilNextMilestone}d</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {VESTING_SCHEDULES.map((s) => (
        <div key={s.name} className="animate-pulse rounded-xl bg-gray-50 p-6">
          <div className="h-4 w-32 rounded bg-gray-200" />
          <div className="mt-2 h-3 w-48 rounded bg-gray-200" />
          <div className="mt-4 h-2 w-full rounded-full bg-gray-200" />
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="h-10 rounded bg-gray-200" />
            <div className="h-10 rounded bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function VestingTracker() {
  const [states, setStates] = useState<VestingState[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const update = () => {
      setStates(VESTING_SCHEDULES.map((s) => calculateVestingState(s)));
    };
    update();
    // Recalculate every hour
    const interval = setInterval(update, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) return <Skeleton />;

  const totalLocked = states.reduce((sum, s) => sum + s.amountLocked, 0);
  const totalVested = states.reduce((sum, s) => sum + s.amountVested, 0);
  const totalTracked = totalLocked + totalVested;

  return (
    <div>
      {/* Summary strip */}
      <div className="mb-6 grid grid-cols-3 gap-4 rounded-xl bg-violet-50 p-4">
        <div className="text-center">
          <p className="text-xs text-violet-500">Total Tracked</p>
          <p className="text-sm font-semibold font-mono text-violet-700">
            {formatNumber(totalTracked)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-emerald-500">Vested</p>
          <p className="text-sm font-semibold font-mono text-emerald-700">
            {formatNumber(totalVested)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500">Locked</p>
          <p className="text-sm font-semibold font-mono text-gray-700">
            {formatNumber(totalLocked)}
          </p>
        </div>
      </div>

      {/* Vesting cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {states.map((state) => (
          <VestingCard key={state.schedule.name} state={state} />
        ))}
      </div>

      <p className="mt-4 text-sm text-gray-500">
        Community Governance, Protocol Treasury, and Public Distribution are unlocked at TGE.
      </p>
    </div>
  );
}
