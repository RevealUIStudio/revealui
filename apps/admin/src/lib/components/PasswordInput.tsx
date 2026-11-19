'use client';

import { Button, IconEye, IconEyeOff } from '@revealui/presentation/server';
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';

interface PasswordInputProps {
  /** Whether the password is currently visible */
  visible: boolean;
  /** Toggle visibility callback */
  onToggle: () => void;
  /** The input element (render with type={visible ? 'text' : 'password'} and className including pr-10) */
  children: ReactNode;
  /** Forwarded from FormField so the input, not the toggle, is described. */
  'aria-invalid'?: boolean | 'true' | 'false';
  /** Forwarded from FormField. Merged with any described-by already on the input. */
  'aria-describedby'?: string;
}

function joinDescribedBy(
  existing: string | undefined,
  extra: string | undefined,
): string | undefined {
  const tokens: string[] = [];
  for (const value of [existing, extra]) {
    if (!value) continue;
    for (const part of value.split(' ')) {
      if (part.length > 0 && !tokens.includes(part)) tokens.push(part);
    }
  }
  return tokens.length > 0 ? tokens.join(' ') : undefined;
}

function withFieldAria(
  child: ReactElement,
  ariaInvalid: boolean | 'true' | 'false' | undefined,
  ariaDescribedBy: string | undefined,
): ReactElement {
  const props = child.props as { 'aria-describedby'?: string };
  const describedBy = joinDescribedBy(props['aria-describedby'], ariaDescribedBy);
  const next: {
    'aria-invalid'?: boolean | 'true' | 'false';
    'aria-describedby'?: string;
  } = {};
  if (ariaInvalid !== undefined) next['aria-invalid'] = ariaInvalid;
  if (describedBy) next['aria-describedby'] = describedBy;
  return cloneElement(child, next);
}

/**
 * Wrapper that overlays a show/hide toggle on a password input.
 *
 * Usage:
 * ```tsx
 * <PasswordInput visible={show} onToggle={() => setShow(v => !v)}>
 *   <Input type={show ? 'text' : 'password'} className="pr-10" ... />
 * </PasswordInput>
 * ```
 */
export function PasswordInput({
  visible,
  onToggle,
  children,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
}: PasswordInputProps) {
  const control = isValidElement(children)
    ? withFieldAria(children, ariaInvalid, ariaDescribedBy)
    : children;
  return (
    <div className="relative">
      {control}
      <Button
        type="button"
        appearance="ghost"
        variant="neutral"
        size="icon"
        onClick={onToggle}
        className="absolute right-2.5 top-1/2 size-7 -translate-y-1/2 text-zinc-400 hover:bg-transparent hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
        aria-label={visible ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {visible ? <IconEye size="sm" /> : <IconEyeOff size="sm" />}
      </Button>
    </div>
  );
}
