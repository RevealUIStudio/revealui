'use client'

import { logger } from '@revealui/core/observability/logger'
import { useState } from 'react'

export function LeadCapture() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const extractErrorMessage = (payload: unknown): string | null => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return null
    }
    const { error } = payload as { error?: unknown }
    return typeof error === 'string' ? error : null
  }

  const submitWaitlist = async () => {
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const payload = (await response.json()) as unknown
      const errorMessage = extractErrorMessage(payload)

      if (!response.ok) {
        throw new Error(errorMessage ?? 'Failed to join waitlist')
      }

      setIsSubmitted(true)
      setEmail('')
    } catch (error) {
      logger.error(
        'Waitlist signup error',
        error instanceof Error ? error : new Error(String(error)),
      )
      setErrorMessage('Failed to join waitlist. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()
    void submitWaitlist()
  }

  if (isSubmitted) {
    return (
      <section className="py-24 bg-blue-600 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="text-6xl mb-8">🎉</div>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              You&apos;re on the list!
            </h2>
            <p className="mt-6 text-lg leading-8 text-blue-100">
              Thanks for your interest in RevealUI. We&apos;ll send you exclusive early access
              details and updates on our launch. Stay tuned!
            </p>
            <button
              onClick={() => setIsSubmitted(false)}
              type="button"
              className="mt-8 rounded-md bg-white px-8 py-4 text-base font-semibold text-blue-600 shadow-sm hover:bg-gray-50 transition-colors"
            >
              Join Another Email
            </button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section id="waitlist" className="py-24 bg-blue-600 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Start building today
          </h2>
          <p className="mt-6 text-lg leading-8 text-blue-100">
            RevealUI is open source and ready to deploy. Sign up for early access to Pro and be
            first in line for new features, announcements, and launch deals.
          </p>
          <form onSubmit={handleSubmit} className="mt-10">
            <div className="flex max-w-md mx-auto gap-x-4">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="min-w-0 flex-auto rounded-md border-0 bg-white px-3.5 py-4 text-base text-gray-900 shadow-sm ring-1 ring-inset ring-white/10 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-white sm:text-sm sm:leading-6"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-none rounded-md bg-white px-8 py-4 text-base font-semibold text-blue-600 shadow-sm hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Joining...' : 'Join Waitlist'}
              </button>
            </div>
          </form>
          {errorMessage && (
            <p className="mt-4 text-sm text-red-200" role="alert">
              {errorMessage}
            </p>
          )}
          <p className="mt-6 text-sm leading-6 text-blue-200">
            No spam, ever. Unsubscribe at any time.
          </p>
        </div>
      </div>
    </section>
  )
}
