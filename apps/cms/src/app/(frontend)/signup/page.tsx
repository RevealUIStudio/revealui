'use client'

import { useSignUp } from '@revealui/auth/react'
import {
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
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create Account</CardTitle>
          <CardDescription>
            {plan === 'pro'
              ? 'Sign up to start your free 7-day Pro trial.'
              : 'Sign up for a free RevealUI account.'}
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

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? 'Creating account...' : 'Create Account'}
            </Button>

            <p className="text-center text-sm text-zinc-500">
              Already have an account?{' '}
              <Link href="/login" className="text-blue-600 hover:underline dark:text-blue-400">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
