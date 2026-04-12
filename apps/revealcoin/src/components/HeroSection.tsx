import { Badge, ButtonCVA } from '@revealui/presentation';
import { EXPLORER_URL, MINT_ADDRESS, TOTAL_SUPPLY_DISPLAY, truncateAddress } from '@/lib/constants';

const badges = [
  { label: 'Token-2022', color: 'violet' as const },
  { label: 'Fixed Supply', color: 'emerald' as const },
  { label: 'Solana', color: 'blue' as const },
  { label: 'No Freeze', color: 'zinc' as const },
];

const stats = [
  { label: 'Total Supply', value: TOTAL_SUPPLY_DISPLAY },
  { label: 'Allocations', value: '7 Categories' },
  { label: 'Token Program', value: 'Token-2022' },
  { label: 'Mint Address', value: truncateAddress(MINT_ADDRESS, 6) },
];

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-[#fafafa] px-6 pt-20 pb-16 sm:pt-28 sm:pb-24 lg:px-8">
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(#7c3aed 1px, transparent 1px), linear-gradient(90deg, #7c3aed 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      <div className="relative mx-auto max-w-4xl text-center">
        {/* Logo */}
        <div className="mb-8 flex justify-center hero-stagger">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-violet-600 text-white text-3xl font-bold shadow-lg shadow-violet-600/25">
            R
          </div>
        </div>

        <Badge
          color="violet"
          className="mb-6 gap-2 rounded-full px-4 py-1.5 ring-1 ring-violet-200/80"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-pulse" />
          Live on Solana Mainnet
        </Badge>

        <h1 className="text-4xl font-bold tracking-tight text-gray-950 sm:text-6xl lg:text-7xl hero-stagger">
          <span className="block">Reveal</span>
          <span className="block bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
            Coin
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-xl font-semibold leading-8 text-gray-700">
          The native token of the RevealUI ecosystem.
        </p>
        <p className="mx-auto mt-3 max-w-2xl text-lg leading-8 text-gray-500">
          Utility payments, governance voting, and ecosystem rewards - built on Solana Token-2022
          with {TOTAL_SUPPLY_DISPLAY} fixed supply.
        </p>

        {/* Supply symbolism */}
        <div className="mt-6 inline-flex items-center gap-3 rounded-xl bg-gray-950 px-5 py-3 font-mono text-sm shadow-lg ring-1 ring-white/10">
          <span className="text-violet-400">58,906,000,000</span>
          <span className="text-gray-500"> - </span>
          <span className="text-gray-300">US currency in circulation, August 14, 1971</span>
        </div>

        {/* Badges */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {badges.map((b) => (
            <Badge key={b.label} color={b.color} className="rounded-lg px-4 py-2.5">
              {b.label}
            </Badge>
          ))}
        </div>

        {/* CTAs */}
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <ButtonCVA
            asChild
            size="lg"
            className="w-full sm:w-auto bg-violet-600 hover:bg-violet-700"
          >
            <a href="/whitepaper">Read Whitepaper</a>
          </ButtonCVA>
          <ButtonCVA asChild variant="outline" size="lg" className="w-full sm:w-auto">
            <a href={EXPLORER_URL} target="_blank" rel="noopener noreferrer" className="gap-1.5">
              View on Explorer
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <title>External link</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                />
              </svg>
            </a>
          </ButtonCVA>
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-xl bg-white p-4 ring-1 ring-gray-950/5">
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="mt-1 text-lg font-semibold text-gray-950 font-mono">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
