/**
 * DataPanel Component
 *
 * Displays a metric panel with value, trend, and status indicators
 */

import { IconAlertCircle, IconChevronDown, IconChevronUp } from '@revealui/presentation/server';
import type React from 'react';

export interface DataPanelProps {
  title: string;
  value: number | string;
  unit?: string;
  trend?: number;
  status?: 'healthy' | 'warning' | 'critical';
  loading?: boolean;
  error?: string;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
  'aria-label'?: string;
}

export function DataPanel({
  title,
  value,
  unit,
  trend,
  status = 'healthy',
  loading,
  error,
  onClick,
  className = '',
  style,
  'aria-label': ariaLabel,
  ref,
}: DataPanelProps & { ref?: React.Ref<HTMLDivElement> }) {
  const formatValue = (val: number | string): string => {
    if (typeof val === 'string') return val;

    // Handle special numeric values
    if (!Number.isFinite(val)) {
      if (val === Number.POSITIVE_INFINITY || val === Number.NEGATIVE_INFINITY) {
        return 'Infinity';
      }
      if (Number.isNaN(val)) {
        return 'Invalid';
      }
    }

    // Format large numbers with commas
    return val.toLocaleString('en-US', {
      maximumFractionDigits: 2,
    });
  };

  const getStatusColor = () => {
    switch (status) {
      case 'healthy':
        return 'bg-success';
      case 'warning':
        return 'bg-warning';
      case 'critical':
        return 'bg-error';
      default:
        return 'bg-muted-foreground';
    }
  };

  const getTrendAriaLabel = (): string => {
    if (trend === undefined) return '';
    if (trend > 0) return `trending up by ${trend.toFixed(1)} percent`;
    if (trend < 0) return `trending down by ${Math.abs(trend).toFixed(1)} percent`;
    return 'no change';
  };

  if (loading) {
    return (
      <output
        ref={ref as React.Ref<HTMLOutputElement>}
        className={`bg-card rounded-lg shadow p-6 ${className}`}
        style={style}
        aria-label={ariaLabel || `${title} panel`}
        data-status={status}
        aria-busy="true"
      >
        <div className="animate-pulse">
          <div className="h-4 bg-foreground/10 rounded w-1/2 mb-4"></div>
          <div className="h-8 bg-foreground/10 rounded w-3/4"></div>
        </div>
      </output>
    );
  }

  if (error) {
    return (
      <div
        ref={ref}
        className={`bg-card rounded-lg shadow p-6 ${className}`}
        style={style}
        role="alert"
        aria-label={ariaLabel || `${title} panel`}
        data-status={status}
      >
        <div className="text-error">
          <IconAlertCircle className="mb-2 size-6" aria-label="Error icon" />
          <p className="font-medium">{error}</p>
        </div>
      </div>
    );
  }

  const panelId = `data-panel-${title.replace(/\s+/g, '-').toLowerCase()}`;
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      ref={ref as React.Ref<HTMLDivElement & HTMLButtonElement>}
      className={`bg-card rounded-lg shadow p-6 transition-all ${
        onClick ? 'cursor-pointer hover:shadow-lg hover:scale-105' : ''
      } ${className}`}
      style={style}
      {...(!onClick && { role: 'region', 'aria-labelledby': panelId })}
      {...(onClick && {
        type: 'button' as const,
        onClick,
        'aria-label': ariaLabel || `${title} panel`,
      })}
      data-status={status}
    >
      <div
        className={`flex items-start justify-between mb-3 ${onClick ? 'cursor-pointer' : ''}`}
        data-status={status}
        tabIndex={onClick ? 0 : undefined}
      >
        <h3 id={panelId} className="text-sm font-medium text-muted-foreground break-words">
          {title}
        </h3>
        <div className="flex items-center gap-2">
          {status && status !== 'healthy' && <output className="sr-only">{status}</output>}
          <div className={`w-3 h-3 rounded-full ${getStatusColor()}`} aria-hidden="true" />
        </div>
      </div>

      <div className="flex items-baseline gap-2 mb-2">
        <p className="text-3xl font-bold text-foreground break-all">{formatValue(value)}</p>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>

      {trend !== undefined && (
        <output
          className={`flex items-center text-sm ${
            trend > 0 ? 'text-success' : trend < 0 ? 'text-error' : 'text-muted-foreground'
          }`}
          aria-live="polite"
        >
          {trend > 0 ? (
            <IconChevronUp className="mr-1 size-4" aria-label="Trending up" />
          ) : trend < 0 ? (
            <IconChevronDown className="mr-1 size-4" aria-label="Trending down" />
          ) : null}
          <span>
            <span className="sr-only">{getTrendAriaLabel()}</span>
            <span aria-hidden="true">{Math.abs(trend).toFixed(1)}%</span>
          </span>
        </output>
      )}
    </Component>
  );
}
