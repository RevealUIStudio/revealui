'use client';

import type { ReactNode } from 'react';

/** Eye icon (open) — password is visible */
function EyeIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx={12} cy={12} r={3} />
    </svg>
  );
}

/** Eye-off icon — password is hidden */
function EyeOffIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

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
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 transition-colors hover:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-zinc-500 dark:hover:text-zinc-300"
        aria-label={visible ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {visible ? <EyeIcon /> : <EyeOffIcon />}
      </button>
    </div>
  );
}
