'use client'

import { useSignIn } from '@revealui/auth/react'
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
import { type FormEvent, useState } from 'react'

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'You cancelled the sign-in. Please try again.',
  provider_error: 'The sign-in provider returned an error. Please try again.',
  invalid_state: 'The sign-in request expired. Please try again.',
  account_exists:
    'An account with this email already exists. Sign in with your password, or link this provider from your account settings.',
  not_allowed: 'Your account is not authorized. Contact the administrator for access.',
  unknown_provider: 'Unknown sign-in provider. Please try again.',
}

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { signIn, isLoading } = useSignIn()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const oauthError = searchParams.get('error')
  const [error, setError] = useState<string | null>(
    oauthError ? (OAUTH_ERROR_MESSAGES[oauthError] ?? 'Sign-in failed. Please try again.') : null,
  )

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const result = await signIn({ email, password })
    if (result.success) {
      router.push('/admin')
    } else {
      setError(result.error || 'Failed to sign in')
    }
  }

  return (
    <AuthLayout>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in to your account</CardTitle>
          <CardDescription>
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-blue-600 hover:underline dark:text-blue-400">
              Sign up
            </Link>
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
                autoComplete="current-password"
                required
              />
            </div>

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>

            <p className="text-center text-sm text-zinc-500">
              <Link
                href="/reset-password"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Forgot password?
              </Link>
            </p>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button variant="outline" className="w-full" asChild>
              <a href="/api/auth/github">Sign in with GitHub</a>
            </Button>
            <Button variant="outline" className="w-full" asChild>
              <a href="/api/auth/google">Sign in with Google</a>
            </Button>
            <Button variant="outline" className="w-full" asChild>
              <a href="/api/auth/vercel">Sign in with Vercel</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
