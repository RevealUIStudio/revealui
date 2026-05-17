'use client';

import {
  ButtonCVA as Button,
  FormLabel,
  Heading,
  InputCVA as Input,
} from '@revealui/presentation/server';
import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { PasswordInput } from '@/lib/components/PasswordInput';

interface SetupFormProps {
  /** Site name resolved server-side to avoid build-time env inlining. */
  siteName: string;
}

export function SetupForm({ siteName }: SetupFormProps) {
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
      <div className="w-full max-w-sm space-y-6">
        <Heading as="h2" size="lg" className="tracking-tight">
          Setup complete
        </Heading>
        <p className="text-sm text-muted-foreground">
          Your admin account has been created. Redirecting to sign in…
        </p>
        <div className="flex justify-center py-4">
          <div className="size-8 animate-spin rounded-full border-4 border-zinc-200 border-t-[var(--tenant-brand,#2563eb)] dark:border-zinc-700" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <Heading as="h2" size="lg" className="tracking-tight">
        Welcome to {siteName}
      </Heading>
      <p className="text-sm text-muted-foreground">Create your admin account to get started.</p>

      {error ? (
        <div
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400"
        >
          {error}
        </div>
      ) : null}

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
          <FormLabel htmlFor="setup-email" required>
            Email
          </FormLabel>
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
          <FormLabel htmlFor="setup-password" required>
            Password
          </FormLabel>
          <PasswordInput visible={showPassword} onToggle={() => setShowPassword((v) => !v)}>
            <Input
              id="setup-password"
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
          <p className="text-xs text-zinc-600 dark:text-zinc-400">Minimum 12 characters</p>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={isLoading || !email || password.length < 12}
        >
          {isLoading ? 'Creating account…' : 'Create admin account'}
        </Button>
      </form>
    </div>
  );
}
