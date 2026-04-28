import { ButtonCVA } from '@revealui/presentation';
import { useState } from 'react';
import { EXPLORER_URL } from '@/lib/constants';

const navLinks = [
  { label: 'Tokenomics', href: '/tokenomics' },
  { label: 'Explorer', href: '/explorer' },
  { label: 'Whitepaper', href: '/whitepaper' },
];

export function NavBar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-white/80 backdrop-blur-lg">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
        <a href="/" className="flex items-center gap-3 text-lg font-bold tracking-tight">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-white text-sm font-bold">
            R
          </div>
          RevealCoin
        </a>

        {/* Desktop nav */}
        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-950"
            >
              {link.label}
            </a>
          ))}
          <ButtonCVA asChild size="sm">
            <a href={EXPLORER_URL} target="_blank" rel="noopener noreferrer">
              View on Explorer
            </a>
          </ButtonCVA>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="md:hidden p-2 text-gray-600"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <title>Menu</title>
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-border/40 bg-white px-6 py-4 md:hidden">
          <div className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-gray-600"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <ButtonCVA asChild size="sm" className="w-full">
              <a href={EXPLORER_URL} target="_blank" rel="noopener noreferrer">
                View on Explorer
              </a>
            </ButtonCVA>
          </div>
        </div>
      )}
    </header>
  );
}
