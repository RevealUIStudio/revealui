'use client';

import { useCallback, useId, useState } from 'react';
import { cn } from '../utils/cn.js';

export function Rating({
  value: controlledValue,
  defaultValue = 0,
  max = 5,
  onChange,
  readOnly = false,
  size = 'md',
  label,
  className,
}: {
  value?: number;
  defaultValue?: number;
  max?: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [hovered, setHovered] = useState(0);
  const id = useId();

  const value = controlledValue ?? internalValue;
  const sizeClass = { sm: 'size-4', md: 'size-6', lg: 'size-8' }[size];

  const handleClick = useCallback(
    (star: number) => {
      if (readOnly) return;
      setInternalValue(star);
      onChange?.(star);
    },
    [readOnly, onChange],
  );

  const display = hovered > 0 ? hovered : value;

  return (
    <div className={className}>
      {label && (
        <span id={id} className="sr-only">
          {label}
        </span>
      )}
      {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-label is valid on both "img" and "radiogroup" roles; dynamic role prevents static analysis */}
      <div
        role={readOnly ? 'img' : 'radiogroup'}
        aria-label={label ?? `Rating: ${value} out of ${max}`}
        aria-labelledby={label ? id : undefined}
        className="flex items-center gap-0.5"
      >
        {Array.from({ length: max }).map((_, i) => {
          const star = i + 1;
          const filled = star <= display;
          return (
            // biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-checked and aria-label are valid on role="radio" per WAI-ARIA spec
            <button
              key={star}
              type="button"
              role={readOnly ? undefined : 'radio'}
              aria-checked={readOnly ? undefined : value === star}
              aria-label={readOnly ? undefined : `${star} star${star !== 1 ? 's' : ''}`}
              disabled={readOnly}
              onClick={() => handleClick(star)}
              onMouseEnter={() => !readOnly && setHovered(star)}
              onMouseLeave={() => !readOnly && setHovered(0)}
              className={cn(
                sizeClass,
                'transition-colors',
                readOnly
                  ? 'cursor-default'
                  : 'cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500',
              )}
            >
              <svg
                viewBox="0 0 20 20"
                aria-hidden="true"
                className={cn(
                  'size-full',
                  filled
                    ? 'fill-amber-400 text-amber-400'
                    : 'fill-zinc-200 text-zinc-200 dark:fill-zinc-700 dark:text-zinc-700',
                )}
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
}
