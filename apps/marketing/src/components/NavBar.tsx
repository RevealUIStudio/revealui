'use client';

import { ButtonCVA } from '@revealui/presentation';
import Link from 'next/link';
import { useState } from 'react';

const navLinks = [
  { label: 'Docs', href: 'https://docs.revealui.com' },
  { label: 'Blog', href: '/blog' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Contact', href: '/contact' },
];

export function NavBar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-950/5">
      <nav className="mx-auto max-w-7xl px-6 lg:px-8 flex items-center justify-between h-16">
        <Link href="/" className="text-xl font-bold tracking-tight text-gray-950">
          RevealUI
        </Link>

        {/* Desktop links */}
        <div className="hidden sm:flex items-center gap-8 text-sm font-medium text-gray-600">
          {navLinks.map(({ label, href }) => (
            <Link key={label} href={href} className="hover:text-gray-900 transition-colors">
              {label}
            </Link>
          ))}
          <a
            href="https://github.com/RevealUIStudio/revealui"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-900 transition-colors"
            aria-label="GitHub"
          >
            <span className="sr-only">GitHub</span>
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z"
                clipRule="evenodd"
              />
            </svg>
          </a>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://admin.revealui.com/login"
            className="hidden sm:inline-flex text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Log in
          </a>
          <ButtonCVA asChild>
            <a href="https://admin.revealui.com/signup">Get Started</a>
          </ButtonCVA>

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
            <a
              href="https://github.com/RevealUIStudio/revealui"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
              onClick={() => setOpen(false)}
            >
              GitHub
            </a>
          </div>
          <div className="mt-4 flex flex-col gap-2 border-t border-gray-100 pt-4">
            <a
              href="https://admin.revealui.com/login"
              className="rounded-md px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
              onClick={() => setOpen(false)}
            >
              Log in
            </a>
            <ButtonCVA asChild className="w-full">
              <a href="https://admin.revealui.com/signup" onClick={() => setOpen(false)}>
                Get Started
              </a>
            </ButtonCVA>
          </div>
        </div>
      )}
    </header>
  );
}
