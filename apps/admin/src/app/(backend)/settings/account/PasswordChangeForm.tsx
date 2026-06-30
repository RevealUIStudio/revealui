'use client';

import { Input } from '@revealui/presentation';
import { Field, Label } from '@revealui/presentation/client';
import { useActionState, useEffect, useState } from 'react';
import { PasswordInput } from '@/lib/components/PasswordInput';
import type { ChangePasswordState } from './actions';
import { changePasswordAction } from './actions';

interface Props {
  onSuccess: () => void;
  onCancel: () => void;
}

export function PasswordChangeForm({ onSuccess, onCancel }: Props) {
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
    <form action={action} className="mt-4 space-y-3">
      {/* Form-level error (wrong current password, server error) */}
      {state?.formError && (
        <div
          role="alert"
          className="rounded-lg border border-red-800/50 bg-red-900/20 px-3 py-2 text-xs text-red-400"
        >
          {state.formError}
        </div>
      )}

      <Field>
        <Label className="block text-xs font-medium text-zinc-400 mb-1">Current password</Label>
        <PasswordInput visible={showCurrent} onToggle={() => setShowCurrent((v) => !v)}>
          <Input
            name="currentPassword"
            type={showCurrent ? 'text' : 'password'}
            autoComplete="current-password"
            required
            aria-invalid={!!state?.fieldErrors?.currentPassword}
            className="pr-10"
          />
        </PasswordInput>
        {state?.fieldErrors?.currentPassword && (
          <p className="mt-1 text-xs text-red-400">{state.fieldErrors.currentPassword[0]}</p>
        )}
      </Field>

      <Field>
        <Label className="block text-xs font-medium text-zinc-400 mb-1">New password</Label>
        <PasswordInput visible={showNew} onToggle={() => setShowNew((v) => !v)}>
          <Input
            name="newPassword"
            type={showNew ? 'text' : 'password'}
            autoComplete="new-password"
            required
            minLength={8}
            aria-invalid={!!state?.fieldErrors?.newPassword}
            className="pr-10"
          />
        </PasswordInput>
        {state?.fieldErrors?.newPassword && (
          <p className="mt-1 text-xs text-red-400">{state.fieldErrors.newPassword[0]}</p>
        )}
      </Field>

      <Field>
        <Label className="block text-xs font-medium text-zinc-400 mb-1">Confirm new password</Label>
        <PasswordInput visible={showConfirm} onToggle={() => setShowConfirm((v) => !v)}>
          <Input
            name="confirmPassword"
            type={showConfirm ? 'text' : 'password'}
            autoComplete="new-password"
            required
            minLength={8}
            aria-invalid={!!state?.fieldErrors?.confirmPassword}
            className="pr-10"
          />
        </PasswordInput>
        {state?.fieldErrors?.confirmPassword && (
          <p className="mt-1 text-xs text-red-400">{state.fieldErrors.confirmPassword[0]}</p>
        )}
      </Field>

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
