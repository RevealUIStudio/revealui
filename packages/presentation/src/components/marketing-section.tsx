import type React from 'react';
import { cn } from '../utils/cn.js';

/**
 * Surface tone for public marketing sections.
 * Maps to semantic background tokens (theme bridge).
 */
export type MarketingSectionTone = 'background' | 'secondary' | 'card';

/**
 * Content column width. `default` matches the marketing max-w-7xl outer rail.
 * `narrow` is intro columns (max-w-3xl). `wide` is max-w-7xl. `full` is 100%.
 */
export type MarketingSectionWidth = 'narrow' | 'default' | 'wide' | 'full';

/** Vertical padding scale shared across marketing routes. */
export type MarketingSectionDensity = 'compact' | 'default' | 'spacious';

export interface MarketingSectionProps extends React.ComponentPropsWithoutRef<'section'> {
  tone?: MarketingSectionTone;
  width?: MarketingSectionWidth;
  density?: MarketingSectionDensity;
  /**
   * When true, omit horizontal padding on the section (children pad themselves).
   * Prefer false unless embedding full-bleed media.
   */
  bleed?: boolean;
  /** Classes for the inner max-width container. */
  innerClassName?: string;
}

const toneClass: Record<MarketingSectionTone, string> = {
  background: 'bg-background',
  secondary: 'bg-secondary',
  card: 'bg-card',
};

const densityClass: Record<MarketingSectionDensity, string> = {
  compact: 'py-16 sm:py-20',
  default: 'py-20 sm:py-28',
  spacious: 'py-16 sm:py-24 lg:py-28',
};

const widthClass: Record<MarketingSectionWidth, string> = {
  narrow: 'max-w-3xl',
  default: 'max-w-7xl',
  wide: 'max-w-7xl',
  full: 'max-w-none',
};

/**
 * Shared marketing section shell: tone, density, and content width.
 *
 * Use for landing / product / legal public pages so route craft cannot invent
 * a fourth padding scale. Put page-specific content as children.
 *
 * @see packages/presentation/docs/marketing-section-system.md
 */
export function MarketingSection({
  tone = 'background',
  width = 'default',
  density = 'default',
  bleed = false,
  className,
  innerClassName,
  children,
  ...props
}: MarketingSectionProps): React.JSX.Element {
  return (
    <section
      data-slot="marketing-section"
      data-tone={tone}
      data-density={density}
      data-width={width}
      className={cn(toneClass[tone], densityClass[density], !bleed && 'px-6 lg:px-8', className)}
      {...props}
    >
      <div className={cn('relative mx-auto w-full', widthClass[width], innerClassName)}>
        {children}
      </div>
    </section>
  );
}

export type SectionHeaderAlign = 'start' | 'center';
export type SectionHeaderEyebrowTone = 'primary' | 'muted';
export type SectionHeaderTitleAs = 'h1' | 'h2' | 'h3';

export interface SectionHeaderProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: SectionHeaderAlign;
  eyebrowTone?: SectionHeaderEyebrowTone;
  /** Heading element. Default h2 for mid-page sections; use h1 on hero intros. */
  titleAs?: SectionHeaderTitleAs;
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
}

const eyebrowToneClass: Record<SectionHeaderEyebrowTone, string> = {
  primary: 'text-primary',
  muted: 'text-muted-foreground',
};

/**
 * Standard marketing intro stack: optional eyebrow, title, optional body.
 * Description uses the body type rung (`text-body`), not muted.
 */
export function SectionHeader({
  eyebrow,
  title,
  description,
  align = 'center',
  eyebrowTone = 'primary',
  titleAs: TitleTag = 'h2',
  className,
  titleClassName,
  descriptionClassName,
}: SectionHeaderProps): React.JSX.Element {
  return (
    <div
      data-slot="section-header"
      className={cn(
        'mx-auto max-w-2xl',
        align === 'center' && 'text-center',
        align === 'start' && 'text-left',
        className,
      )}
    >
      {eyebrow != null && eyebrow !== false && eyebrow !== '' ? (
        <p
          data-slot="section-eyebrow"
          className={cn(
            'text-xs font-semibold uppercase tracking-widest',
            eyebrowToneClass[eyebrowTone],
          )}
        >
          {eyebrow}
        </p>
      ) : null}
      <TitleTag
        data-slot="section-title"
        className={cn(
          'font-display text-3xl font-bold tracking-tight text-foreground text-balance sm:text-4xl',
          eyebrow != null && eyebrow !== false && eyebrow !== '' ? 'mt-3' : null,
          titleClassName,
        )}
      >
        {title}
      </TitleTag>
      {description != null && description !== false && description !== '' ? (
        <p
          data-slot="section-description"
          className={cn('mt-5 text-lg leading-8 text-body', descriptionClassName)}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
