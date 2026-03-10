'use client'

import { useSignUp } from '@revealui/auth/react'
import {
  AuthLayout,
  ButtonCVA as Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormLabel,
  InputCVA as Input,
} from '@revealui/presentation/server'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { type FormEvent, Suspense, useState } from 'react'

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <AuthLayout>
          <Card className="w-full max-w-sm">
            <CardHeader>
              <div className="h-6 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
              <div className="mt-2 h-4 w-64 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="h-10 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                <div className="h-10 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                <div className="h-10 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                <div className="h-10 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
              </div>
            </CardContent>
          </Card>
        </AuthLayout>
      }
    >
      <SignupContent />
    </Suspense>
  )
}

function SignupContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const plan = searchParams.get('plan')
  const { signUp, isLoading } = useSignUp()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [tosAccepted, setTosAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!tosAccepted) {
      setError('You must accept the Terms of Service to create an account.')
      return
    }

    const result = await signUp({ email, password, name, tosAccepted: true })
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
    <AuthLayout>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>
            {plan === 'pro' ? (
              'Sign up to start your free 7-day Pro trial.'
            ) : (
              <>
                Already have an account?{' '}
                <Link href="/login" className="text-blue-600 hover:underline dark:text-blue-400">
                  Sign in
                </Link>
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <FormLabel htmlFor="name" required>
                Name
              </FormLabel>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
                autoComplete="name"
                required
              />
            </div>

            <div className="space-y-2">
              <FormLabel htmlFor="email" required>
                Email
              </FormLabel>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-2">
              <FormLabel htmlFor="password" required>
                Password
              </FormLabel>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="new-password"
                minLength={8}
                required
              />
              <p className="text-xs text-zinc-500">Minimum 8 characters</p>
            </div>

            <div className="flex items-start gap-2">
              <input
                id="tos"
                type="checkbox"
                checked={tosAccepted}
                onChange={(e) => setTosAccepted(e.target.checked)}
                disabled={isLoading}
                required
                className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-blue-600"
              />
              <label htmlFor="tos" className="text-sm text-zinc-600 dark:text-zinc-400">
                I agree to the{' '}
                <Link
                  href="/legal/terms"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                  target="_blank"
                >
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link
                  href="/legal/privacy"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                  target="_blank"
                >
                  Privacy Policy
                </Link>
              </label>
            </div>

            <Button type="submit" disabled={isLoading || !tosAccepted} className="w-full">
              {isLoading ? 'Creating account...' : 'Create account'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
