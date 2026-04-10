'use client';

import {
  ButtonCVA as Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormLabel,
  InputCVA as Input,
} from '@revealui/presentation/server';
import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { BrandedAuthLayout } from '@/lib/components/BrandedAuthLayout';
import { PasswordInput } from '@/lib/components/PasswordInput';

export default function SetupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name: name || undefined, seed: true }),
      });

      const data = await res.json();

      if (data.status === 'created') {
        setSuccess(true);
        setTimeout(() => router.push('/login'), 2000);
        return;
      }

      if (data.status === 'locked') {
        router.push('/login');
        return;
      }

      setError(data.message ?? 'Setup failed. Please try again.');
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <BrandedAuthLayout>
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Setup Complete</CardTitle>
            <CardDescription>
              Your admin account has been created. Redirecting to sign in...
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center py-4">
              <div className="size-8 animate-spin rounded-full border-4 border-zinc-200 border-t-orange-600 dark:border-zinc-700 dark:border-t-orange-500" />
            </div>
          </CardContent>
        </Card>
      </BrandedAuthLayout>
    );
  }

  return (
    <BrandedAuthLayout>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Welcome to RevealUI</CardTitle>
          <CardDescription>Create your admin account to get started.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <FormLabel htmlFor="setup-name">Name</FormLabel>
              <Input
                id="setup-name"
                type="text"
                placeholder="Admin"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </div>

            <div className="space-y-1.5">
              <FormLabel htmlFor="setup-email">Email</FormLabel>
              <Input
                id="setup-email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-1.5">
              <FormLabel htmlFor="setup-password">Password</FormLabel>
              <PasswordInput visible={showPassword} onToggle={() => setShowPassword((v) => !v)}>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={12}
                  autoComplete="new-password"
                  className="pr-10"
                  aria-label="Password"
                />
              </PasswordInput>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Minimum 12 characters</p>
            </div>

            {error ? (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
                {error}
              </p>
            ) : null}

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !email || password.length < 12}
            >
              {isLoading ? 'Creating account...' : 'Create Admin Account'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </BrandedAuthLayout>
  );
}
