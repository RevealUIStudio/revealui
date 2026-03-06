'use client'

import Link from 'next/link'
import { useState } from 'react'

const navLinks = [
  { label: 'Docs', href: 'https://docs.revealui.com' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'GitHub', href: 'https://github.com/RevealUIStudio/revealui' },
]

export function NavBar() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b border-gray-100">
      <nav className="mx-auto max-w-7xl px-6 lg:px-8 flex items-center justify-between h-16">
        <Link href="/" className="text-xl font-bold text-gray-900">
          RevealUI
        </Link>

        {/* Desktop links */}
        <div className="hidden sm:flex items-center gap-8 text-sm font-medium text-gray-600">
          {navLinks.map(({ label, href }) => (
            <Link key={label} href={href} className="hover:text-gray-900 transition-colors">
              {label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/#waitlist"
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
          >
            Get Early Access
          </a>

          {/* Hamburger — mobile only */}
          <button
            type="button"
            className="sm:hidden -mr-1 flex h-9 w-9 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? (
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="sm:hidden border-t border-gray-100 bg-white px-6 py-4">
          <div className="flex flex-col gap-1">
            {navLinks.map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                className="rounded-md px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                onClick={() => setOpen(false)}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  )
}
