import { Link } from '@revealui/router';

const navLinks = [
  { href: '/services', label: 'Services' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export function NavBar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-200 bg-white/80 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span className="text-gray-950">RevealUI</span>
          <span className="text-gray-500">Studio</span>
        </Link>
        <div className="flex items-center gap-8">
          <ul className="flex items-center gap-6 text-sm">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link to={link.href} className="text-gray-600 hover:text-gray-950 transition-colors">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <a
            href="https://revealui.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden text-sm text-gray-500 hover:text-gray-950 transition-colors sm:inline-flex"
          >
            revealui.com →
          </a>
          <Link
            to="/contact"
            className="inline-flex items-center rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
          >
            Book a call
          </Link>
        </div>
      </nav>
    </header>
  );
}
