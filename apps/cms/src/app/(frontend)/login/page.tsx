'use client'

import { useSignIn } from '@revealui/auth/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'

export default function LoginPage() {
  const router = useRouter()
  const { signIn, isLoading } = useSignIn()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const result = await signIn({ email, password })
    if (result.success) {
      router.push('/')
    } else {
      setError(result.error || 'Failed to sign in')
    }
  }

  return (
    <main className="flex min-h-[80vh] items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">
            Sign in to your account
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Don&apos;t have an account?{' '}
            <Link
              href="/signup"
              className="font-medium text-zinc-950 underline decoration-zinc-950/50 hover:decoration-zinc-950 dark:text-white dark:decoration-white/50 dark:hover:decoration-white"
            >
              Sign up
            </Link>
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
              autoComplete="current-password"
              required
              className="mt-2 block w-full rounded-lg border border-zinc-950/10 bg-transparent px-3.5 py-2.5 text-sm text-zinc-950 shadow-sm placeholder:text-zinc-500 focus:outline-2 focus:-outline-offset-1 focus:outline-blue-500 disabled:opacity-50 sm:px-3 sm:py-1.5 dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-zinc-900 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 focus:outline-2 focus:outline-offset-2 focus:outline-blue-500 disabled:opacity-50 dark:bg-zinc-600 dark:hover:bg-zinc-500"
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>

          <div className="flex justify-between text-sm">
            <Link
              href="/reset-password"
              className="font-medium text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
            >
              Forgot password?
            </Link>
          </div>
        </form>
      </div>
    </main>
  )
}
