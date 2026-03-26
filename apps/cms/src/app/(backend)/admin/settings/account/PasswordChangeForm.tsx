'use client';

import { useActionState, useEffect, useId, useState } from 'react';
import { PasswordInput } from '@/lib/components/PasswordInput';
import type { ChangePasswordState } from './actions';
import { changePasswordAction } from './actions';

interface Props {
  onSuccess: () => void;
  onCancel: () => void;
}

export function PasswordChangeForm({ onSuccess, onCancel }: Props) {
  const formId = useId();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [state, action, isPending] = useActionState<ChangePasswordState | undefined, FormData>(
    changePasswordAction,
    undefined,
  );

  useEffect(() => {
    if (state?.status === 'success') {
      onSuccess();
    }
  }, [state?.status, onSuccess]);

  return (
    <form id={formId} action={action} className="mt-4 space-y-3">
      {/* Form-level error (wrong current password, server error) */}
      {state?.formError && (
        <div
          role="alert"
          className="rounded-lg border border-red-800/50 bg-red-900/20 px-3 py-2 text-xs text-red-400"
        >
          {state.formError}
        </div>
      )}

      <div>
        <label
          htmlFor={`${formId}-current`}
          className="block text-xs font-medium text-zinc-400 mb-1"
        >
          Current password
        </label>
        <PasswordInput visible={showCurrent} onToggle={() => setShowCurrent((v) => !v)}>
          <input
            id={`${formId}-current`}
            name="currentPassword"
            type={showCurrent ? 'text' : 'password'}
            autoComplete="current-password"
            required
            aria-invalid={!!state?.fieldErrors?.currentPassword}
            aria-describedby={
              state?.fieldErrors?.currentPassword ? `${formId}-current-error` : undefined
            }
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 pr-10 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none aria-invalid:border-red-700"
          />
        </PasswordInput>
        {state?.fieldErrors?.currentPassword && (
          <p id={`${formId}-current-error`} className="mt-1 text-xs text-red-400">
            {state.fieldErrors.currentPassword[0]}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={`${formId}-new`} className="block text-xs font-medium text-zinc-400 mb-1">
          New password
        </label>
        <PasswordInput visible={showNew} onToggle={() => setShowNew((v) => !v)}>
          <input
            id={`${formId}-new`}
            name="newPassword"
            type={showNew ? 'text' : 'password'}
            autoComplete="new-password"
            required
            minLength={8}
            aria-invalid={!!state?.fieldErrors?.newPassword}
            aria-describedby={state?.fieldErrors?.newPassword ? `${formId}-new-error` : undefined}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 pr-10 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none aria-invalid:border-red-700"
          />
        </PasswordInput>
        {state?.fieldErrors?.newPassword && (
          <p id={`${formId}-new-error`} className="mt-1 text-xs text-red-400">
            {state.fieldErrors.newPassword[0]}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor={`${formId}-confirm`}
          className="block text-xs font-medium text-zinc-400 mb-1"
        >
          Confirm new password
        </label>
        <PasswordInput visible={showConfirm} onToggle={() => setShowConfirm((v) => !v)}>
          <input
            id={`${formId}-confirm`}
            name="confirmPassword"
            type={showConfirm ? 'text' : 'password'}
            autoComplete="new-password"
            required
            minLength={8}
            aria-invalid={!!state?.fieldErrors?.confirmPassword}
            aria-describedby={
              state?.fieldErrors?.confirmPassword ? `${formId}-confirm-error` : undefined
            }
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 pr-10 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none aria-invalid:border-red-700"
          />
        </PasswordInput>
        {state?.fieldErrors?.confirmPassword && (
          <p id={`${formId}-confirm-error`} className="mt-1 text-xs text-red-400">
            {state.fieldErrors.confirmPassword[0]}
          </p>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? 'Updating...' : 'Update password'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
