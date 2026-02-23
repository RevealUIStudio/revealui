'use client'

import { useSignUp } from '@revealui/auth/react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { type FormEvent, useState } from 'react'

export default function SignupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const plan = searchParams.get('plan')
  const { signUp, isLoading } = useSignUp()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const result = await signUp({ email, password, name })
    if (result.success) {
      if (plan === 'pro') {
        router.push('/account/billing?upgrade=pro')
      } else {
        router.push('/')
      }
    } else {
      setError(result.error || 'Failed to create account')
    }
  }

  return (
    <main className="flex min-h-[80vh] items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">
            Create your account
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {plan === 'pro'
              ? 'Sign up to start your free 7-day Pro trial.'
              : 'Already have an account? '}
            {plan !== 'pro' && (
              <Link
                href="/login"
                className="font-medium text-zinc-950 underline decoration-zinc-950/50 hover:decoration-zinc-950 dark:text-white dark:decoration-white/50 dark:hover:decoration-white"
              >
                Sign in
              </Link>
            )}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-zinc-950 dark:text-white"
            >
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
              autoComplete="name"
              required
              className="mt-2 block w-full rounded-lg border border-zinc-950/10 bg-transparent px-3.5 py-2.5 text-sm text-zinc-950 shadow-sm placeholder:text-zinc-500 focus:outline-2 focus:-outline-offset-1 focus:outline-blue-500 disabled:opacity-50 sm:px-3 sm:py-1.5 dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-zinc-950 dark:text-white"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              autoComplete="email"
              required
              className="mt-2 block w-full rounded-lg border border-zinc-950/10 bg-transparent px-3.5 py-2.5 text-sm text-zinc-950 shadow-sm placeholder:text-zinc-500 focus:outline-2 focus:-outline-offset-1 focus:outline-blue-500 disabled:opacity-50 sm:px-3 sm:py-1.5 dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-zinc-950 dark:text-white"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              autoComplete="new-password"
              minLength={8}
              required
              className="mt-2 block w-full rounded-lg border border-zinc-950/10 bg-transparent px-3.5 py-2.5 text-sm text-zinc-950 shadow-sm placeholder:text-zinc-500 focus:outline-2 focus:-outline-offset-1 focus:outline-blue-500 disabled:opacity-50 sm:px-3 sm:py-1.5 dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Minimum 8 characters</p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-zinc-900 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 focus:outline-2 focus:outline-offset-2 focus:outline-blue-500 disabled:opacity-50 dark:bg-zinc-600 dark:hover:bg-zinc-500"
          >
            {isLoading ? 'Creating account...' : 'Create account'}
          </button>
        </form>
      </div>
    </main>
  )
}
