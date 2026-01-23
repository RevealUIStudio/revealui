'use client'

import { logger } from '@revealui/core'
import { useState } from 'react'

export function LeadCapture() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join waitlist')
      }

      setIsSubmitted(true)
      setEmail('')
    } catch (error) {
      logger.error('Waitlist signup error', { error })
      alert('Failed to join waitlist. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
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
    <section className="py-24 bg-blue-600 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Get Early Access to RevealUI
          </h2>
          <p className="mt-6 text-lg leading-8 text-blue-100">
            Be among the first agencies to deploy white-label CMS solutions. Join our exclusive beta
            program and get 6 months free.
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
          <p className="mt-6 text-sm leading-6 text-blue-200">
            No spam, ever. Unsubscribe at any time.
          </p>
        </div>
      </div>
    </section>
  )
}
