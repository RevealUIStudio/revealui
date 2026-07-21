'use client';

import { Button, IconEye, IconEyeOff } from '@revealui/presentation/server';
import type { ReactNode } from 'react';

interface PasswordInputProps {
  /** Whether the password is currently visible */
  visible: boolean;
  /** Toggle visibility callback */
  onToggle: () => void;
  /** The input element (render with type={visible ? 'text' : 'password'} and className including pr-10) */
  children: ReactNode;
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
export function PasswordInput({ visible, onToggle, children }: PasswordInputProps) {
  return (
    <div className="relative">
      {children}
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
