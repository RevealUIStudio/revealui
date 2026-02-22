'use client'

import { useSignIn } from '@revealui/auth/react'
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
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign In</CardTitle>
          <CardDescription>Enter your credentials to access your account.</CardDescription>
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
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>

            <div className="flex justify-between text-sm">
              <Link
                href="/reset-password"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Forgot password?
              </Link>
              <Link href="/signup" className="text-blue-600 hover:underline dark:text-blue-400">
                Create account
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
