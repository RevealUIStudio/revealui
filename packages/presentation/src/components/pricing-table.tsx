import { cn } from '../utils/cn.js';

// =============================================================================
// Types (mirrors @revealui/contracts/pricing  -  no import to avoid coupling)
// =============================================================================

export interface PricingTier {
  id: string;
  name: string;
  price?: string;
  period?: string;
  description: string;
  features: string[];
  cta: string;
  ctaHref: string;
  highlighted: boolean;
}

export interface PricingTableProps {
  tiers: PricingTier[];
  /** Highlights the active plan tier */
  currentTier?: string;
  /** Compact (horizontal row) vs full (grid) layout */
  compact?: boolean;
  /** Callback when a tier is selected */
  onSelectTier?: (id: string) => void;
  className?: string;
}

// =============================================================================
// Check Icon (inline SVG  -  no external deps)
// =============================================================================

function CheckIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-blue-600 mt-0.5"
      fill="currentColor"
      viewBox="0 0 20 20"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// =============================================================================
// PricingTable
// =============================================================================

export function PricingTable({
  tiers,
  currentTier,
  compact = false,
  onSelectTier,
  className,
}: PricingTableProps) {
  if (compact) {
    return (
      <div className={cn('flex flex-col gap-4 sm:flex-row', className)}>
        {tiers.map((tier) => (
          <PricingCardCompact
            key={tier.id}
            tier={tier}
            isCurrent={tier.id === currentTier}
            onSelect={onSelectTier}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4',
        tiers.length === 3 && 'lg:grid-cols-3',
        tiers.length === 2 && 'lg:grid-cols-2 max-w-3xl mx-auto',
        className,
      )}
    >
      {tiers.map((tier) => (
        <PricingCardFull
          key={tier.id}
          tier={tier}
          isCurrent={tier.id === currentTier}
          onSelect={onSelectTier}
        />
      ))}
    </div>
  );
}

// =============================================================================
// Full Card (marketing grid layout)
// =============================================================================

function PricingCardFull({
  tier,
  isCurrent,
  onSelect,
}: {
  tier: PricingTier;
  isCurrent: boolean;
  onSelect?: (id: string) => void;
}) {
  const isHighlighted = tier.highlighted && !isCurrent;

  return (
    <div
      className={cn(
        'relative rounded-2xl bg-white p-8 shadow-lg dark:bg-zinc-900',
        isHighlighted
          ? 'ring-2 ring-blue-600'
          : isCurrent
            ? 'ring-2 ring-emerald-500'
            : 'ring-1 ring-zinc-200 dark:ring-zinc-800',
      )}
    >
      {isHighlighted && (
        <div className="absolute -top-4 left-0 right-0 mx-auto w-32 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1.5 text-sm font-semibold text-white text-center shadow-lg">
          Most Popular
        </div>
      )}
      {isCurrent && (
        <div className="absolute -top-4 left-0 right-0 mx-auto w-32 rounded-full bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white text-center shadow-lg">
          Current Plan
        </div>
      )}

      <div className="mb-8">
        <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
          {tier.name}
        </h3>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{tier.description}</p>
        <p className="mt-6 flex items-baseline gap-x-1">
          <span className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">
            {tier.price ?? '-'}
          </span>
          {tier.period && (
            <span className="text-sm text-zinc-600 dark:text-zinc-400">{tier.period}</span>
          )}
        </p>
      </div>

      <ul className="mb-8 space-y-3">
        {tier.features.map((feature) => (
          <li key={feature} className="flex items-start gap-x-3">
            <CheckIcon />
            <span className="text-sm text-zinc-600 dark:text-zinc-400">{feature}</span>
          </li>
        ))}
      </ul>

      {onSelect ? (
        <button
          type="button"
          onClick={() => onSelect(tier.id)}
          disabled={isCurrent}
          className={cn(
            'block w-full rounded-md px-6 py-3 text-center text-sm font-semibold transition-colors',
            isCurrent
              ? 'cursor-default bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
              : isHighlighted
                ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-sm'
                : 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700',
          )}
        >
          {isCurrent ? 'Current Plan' : tier.cta}
        </button>
      ) : (
        <a
          href={tier.ctaHref}
          className={cn(
            'block w-full rounded-md px-6 py-3 text-center text-sm font-semibold transition-colors',
            isHighlighted
              ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-sm'
              : 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700',
          )}
        >
          {tier.cta}
        </a>
      )}
    </div>
  );
}

// =============================================================================
// Compact Card (embeddable in dialogs/prompts)
// =============================================================================

function PricingCardCompact({
  tier,
  isCurrent,
  onSelect,
}: {
  tier: PricingTier;
  isCurrent: boolean;
  onSelect?: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        'flex-1 rounded-xl p-5 shadow-sm dark:bg-zinc-900',
        isCurrent
          ? 'ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10'
          : tier.highlighted
            ? 'ring-2 ring-blue-600 bg-blue-50/50 dark:bg-blue-900/10'
            : 'ring-1 ring-zinc-200 bg-white dark:ring-zinc-800',
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-bold text-zinc-900 dark:text-white">{tier.name}</h4>
        {isCurrent && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            Current
          </span>
        )}
      </div>
      <p className="mt-1 flex items-baseline gap-x-1">
        <span className="text-2xl font-bold text-zinc-900 dark:text-white">
          {tier.price ?? '-'}
        </span>
        {tier.period && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{tier.period}</span>
        )}
      </p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
        {tier.description}
      </p>

      {onSelect ? (
        <button
          type="button"
          onClick={() => onSelect(tier.id)}
          disabled={isCurrent}
          className={cn(
            'mt-3 block w-full rounded-md px-3 py-2 text-center text-xs font-semibold transition-colors',
            isCurrent
              ? 'cursor-default bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
              : tier.highlighted
                ? 'bg-blue-600 text-white hover:bg-blue-500'
                : 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700',
          )}
        >
          {isCurrent ? 'Current' : tier.cta}
        </button>
      ) : (
        <a
          href={tier.ctaHref}
          className={cn(
            'mt-3 block w-full rounded-md px-3 py-2 text-center text-xs font-semibold transition-colors',
            tier.highlighted
              ? 'bg-blue-600 text-white hover:bg-blue-500'
              : 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700',
          )}
        >
          {tier.cta}
        </a>
      )}
    </div>
  );
}
