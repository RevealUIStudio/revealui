interface TierBadgeProps {
  tier: string;
}

export default function TierBadge({ tier }: TierBadgeProps) {
  const color =
    tier === 'T1'
      ? 'bg-orange-600/20 text-orange-400 border-orange-600/30'
      : tier === 'T0'
        ? 'bg-neutral-700/30 text-neutral-400 border-neutral-600/30'
        : 'bg-neutral-800 text-neutral-500 border-neutral-700';

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${color}`}
    >
      {tier}
    </span>
  );
}
