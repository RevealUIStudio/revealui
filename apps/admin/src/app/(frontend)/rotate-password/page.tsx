'use client';

import {
  ButtonCVA as Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  InputCVA as Input,
} from '@revealui/presentation/server';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { BrandedAuthLayout } from '@/lib/components/BrandedAuthLayout';
import { PasswordInput } from '@/lib/components/PasswordInput';

export default function RotatePasswordPage() {
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
      const response = await fetch('/api/auth/change-password', {
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
    <BrandedAuthLayout>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Password Rotation Required</CardTitle>
          <CardDescription>
            Your account requires a password change before you can continue. Please set a new
            password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="current-password" className="text-sm font-medium">
                Current Password
              </label>
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
              <label htmlFor="new-password" className="text-sm font-medium">
                New Password
              </label>
              <PasswordInput
                visible={showNewPassword}
                onToggle={() => setShowNewPassword((v) => !v)}
              >
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
              <label htmlFor="confirm-password" className="text-sm font-medium">
                Confirm New Password
              </label>
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
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Changing Password...' : 'Change Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </BrandedAuthLayout>
  );
}
