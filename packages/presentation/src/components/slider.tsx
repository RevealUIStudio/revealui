'use client';

import type React from 'react';
import { useCallback, useId, useState } from 'react';
import { cn } from '../utils/cn.js';

export function Slider({
  value: controlledValue,
  defaultValue = 0,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  disabled = false,
  label,
  showValue = false,
  /** Formatted value shown opposite the label (e.g. "$10k"). Overrides raw showValue. */
  valueLabel,
  className,
}: {
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  onChange?: (value: number) => void;
  disabled?: boolean;
  label?: string;
  showValue?: boolean;
  valueLabel?: string;
  className?: string;
}) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const value = controlledValue ?? internalValue;
  const id = useId();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = Number(e.target.value);
      setInternalValue(next);
      onChange?.(next);
    },
    [onChange],
  );

  const percentage = ((value - min) / (max - min)) * 100;
  const rightDisplay = valueLabel ?? (showValue ? String(value) : null);

  return (
    <div className={cn('w-full', className)}>
      {(label || rightDisplay) && (
        <div className="mb-2 flex items-center justify-between">
          {label && (
            <label htmlFor={id} className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {label}
            </label>
          )}
          {rightDisplay && (
            <span className="text-sm text-zinc-500 dark:text-zinc-400" aria-hidden={Boolean(label)}>
              {rightDisplay}
            </span>
          )}
        </div>
      )}
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={handleChange}
        // When no visible label is provided, still expose a name for AT / axe.
        // With `label` set, the <label htmlFor> association is the primary name.
        aria-label={label ? undefined : 'Slider'}
        style={{ '--slider-pct': `${percentage}%` } as React.CSSProperties}
        className={cn(
          'h-2 w-full cursor-pointer appearance-none rounded-full outline-none',
          'bg-zinc-200 dark:bg-zinc-700',
          '[&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none',
          '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:shadow-sm',
          '[&::-webkit-slider-thumb]:ring-2 [&::-webkit-slider-thumb]:ring-white [&::-webkit-slider-thumb]:dark:ring-zinc-900',
          '[&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:appearance-none',
          '[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:bg-blue-600',
          'focus-visible:[&::-webkit-slider-thumb]:outline-2 focus-visible:[&::-webkit-slider-thumb]:outline-offset-2 focus-visible:[&::-webkit-slider-thumb]:outline-blue-500',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      />
    </div>
  );
}
