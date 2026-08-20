import { cn } from '../utils/cn.js';

// =============================================================================
// Types (mirrors @revealui/contracts/pricing - no import to avoid coupling)
// =============================================================================

export interface PricingTier {
  id: string;
  name: string;
  price?: string;
  period?: string;
  /** Optional annual-savings line under the price (marketing). */
  savings?: string;
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
  /** Badge copy for highlighted tiers. Default: Most Popular. */
  highlightedLabel?: string;
  className?: string;
}

// =============================================================================
// Check Icon (inline SVG - no external deps)
// =============================================================================

function CheckIcon() {
  return (
    <svg
      className="mt-0.5 h-4 w-4 shrink-0 text-primary"
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

function isSalesAssistedHref(href: string): boolean {
  return href.startsWith('https://') || href.startsWith('http://') || href.startsWith('mailto:');
}

function usesCheckoutSelect(tier: PricingTier, onSelect?: (id: string) => void): boolean {
  return Boolean(onSelect) && !isSalesAssistedHref(tier.ctaHref);
}

export function PricingTable({
  tiers,
  currentTier,
  compact = false,
  onSelectTier,
  highlightedLabel = 'Most Popular',
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
          highlightedLabel={highlightedLabel}
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
  highlightedLabel,
}: {
  tier: PricingTier;
  isCurrent: boolean;
  onSelect?: (id: string) => void;
  highlightedLabel: string;
}) {
  const isHighlighted = tier.highlighted && !isCurrent;

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-2xl bg-card p-8 shadow-lg',
        isHighlighted
          ? 'ring-2 ring-primary'
          : isCurrent
            ? 'ring-2 ring-success'
            : 'ring-1 ring-border',
      )}
    >
      {isHighlighted && (
        <div className="absolute -top-4 left-0 right-0 mx-auto w-max max-w-[90%] rounded-full bg-primary px-3 py-1.5 text-center text-sm font-semibold text-primary-foreground shadow-lg">
          {highlightedLabel}
        </div>
      )}
      {isCurrent && (
        <div className="absolute -top-4 left-0 right-0 mx-auto w-32 rounded-full bg-success/15 px-3 py-1.5 text-center text-sm font-semibold text-success ring-1 ring-inset ring-success/30">
          Current Plan
        </div>
      )}

      <div className="mb-8">
        <h3 className="text-xl font-bold tracking-tight text-foreground">{tier.name}</h3>
        <p className="mt-2 text-sm leading-6 text-body">{tier.description}</p>
        <p className="mt-6 flex items-baseline gap-x-1">
          <span className="text-4xl font-bold tracking-tight text-foreground">
            {tier.price ?? '-'}
          </span>
          {tier.period && <span className="text-sm text-muted-foreground">{tier.period}</span>}
        </p>
        {tier.savings ? (
          <p className="mt-1 text-xs font-medium text-success">{tier.savings}</p>
        ) : null}
      </div>

      <ul className="mb-8 flex-1 space-y-3">
        {tier.features.map((feature) => (
          <li key={feature} className="flex items-start gap-x-3">
            <CheckIcon />
            <span className="text-sm text-body">{feature}</span>
          </li>
        ))}
      </ul>

      {usesCheckoutSelect(tier, onSelect) ? (
        <button
          type="button"
          onClick={() => onSelect?.(tier.id)}
          disabled={isCurrent}
          className={cn(
            'block w-full rounded-md px-6 py-3 text-center text-sm font-semibold transition-colors',
            isCurrent
              ? 'cursor-default bg-success/10 text-success'
              : isHighlighted
                ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
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
              ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
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
        'flex-1 rounded-xl bg-card p-5 shadow-sm',
        isCurrent
          ? 'ring-2 ring-success bg-success/5'
          : tier.highlighted
            ? 'ring-2 ring-primary bg-primary/5'
            : 'ring-1 ring-border',
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-bold text-foreground">{tier.name}</h4>
        {isCurrent && (
          <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
            Current
          </span>
        )}
      </div>
      <p className="mt-1 flex items-baseline gap-x-1">
        <span className="text-2xl font-bold text-foreground">{tier.price ?? '-'}</span>
        {tier.period && <span className="text-xs text-muted-foreground">{tier.period}</span>}
      </p>
      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{tier.description}</p>

      {usesCheckoutSelect(tier, onSelect) ? (
        <button
          type="button"
          onClick={() => onSelect?.(tier.id)}
          disabled={isCurrent}
          className={cn(
            'mt-3 block w-full rounded-md px-3 py-2 text-center text-xs font-semibold transition-colors',
            isCurrent
              ? 'cursor-default bg-success/10 text-success'
              : tier.highlighted
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
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
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
          )}
        >
          {tier.cta}
        </a>
      )}
    </div>
  );
}
