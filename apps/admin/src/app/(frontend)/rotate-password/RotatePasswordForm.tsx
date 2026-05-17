'use client';

import {
  ButtonCVA as Button,
  FormLabel,
  Heading,
  InputCVA as Input,
} from '@revealui/presentation/server';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { PasswordInput } from '@/lib/components/PasswordInput';
import { apiFetch } from '@/lib/utils/csrf';

export function RotatePasswordForm() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (newPassword === currentPassword) {
      setError('New password must be different from current password.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          revokeOtherSessions: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error?.message ?? data.message ?? 'Failed to change password.');
        return;
      }

      router.push('/');
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6">
      <Heading as="h2" size="lg" className="tracking-tight">
        Password rotation required
      </Heading>
      <p className="text-sm text-muted-foreground">
        Your account requires a password change before you can continue. Please set a new password.
      </p>

      {error && (
        <div
          role="alert"
          className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <FormLabel htmlFor="current-password" required>
            Current password
          </FormLabel>
          <PasswordInput
            visible={showCurrentPassword}
            onToggle={() => setShowCurrentPassword((v) => !v)}
          >
            <Input
              id="current-password"
              type={showCurrentPassword ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="pr-10"
            />
          </PasswordInput>
        </div>

        <div className="space-y-2">
          <FormLabel htmlFor="new-password" required>
            New password
          </FormLabel>
          <PasswordInput visible={showNewPassword} onToggle={() => setShowNewPassword((v) => !v)}>
            <Input
              id="new-password"
              type={showNewPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              required
              className="pr-10"
            />
          </PasswordInput>
        </div>

        <div className="space-y-2">
          <FormLabel htmlFor="confirm-password" required>
            Confirm new password
          </FormLabel>
          <PasswordInput
            visible={showConfirmPassword}
            onToggle={() => setShowConfirmPassword((v) => !v)}
          >
            <Input
              id="confirm-password"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
              className="pr-10"
            />
          </PasswordInput>
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? 'Changing password…' : 'Change password'}
        </Button>
      </form>
    </div>
  );
}
