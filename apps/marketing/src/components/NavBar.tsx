import Link from 'next/link'

export function NavBar() {
  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b border-gray-100">
      <nav className="mx-auto max-w-7xl px-6 lg:px-8 flex items-center justify-between h-16">
        <Link href="/" className="text-xl font-bold text-gray-900">
          RevealUI
        </Link>

        <div className="hidden sm:flex items-center gap-8 text-sm font-medium text-gray-600">
          <Link href="https://docs.revealui.com" className="hover:text-gray-900 transition-colors">
            Docs
          </Link>
          <Link href="/pricing" className="hover:text-gray-900 transition-colors">
            Pricing
          </Link>
          <Link
            href="https://github.com/RevealUIStudio"
            className="hover:text-gray-900 transition-colors"
          >
            GitHub
          </Link>
        </div>

        <a
          href="#waitlist"
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
        >
          Get Early Access
        </a>
      </nav>
    </header>
  )
}
