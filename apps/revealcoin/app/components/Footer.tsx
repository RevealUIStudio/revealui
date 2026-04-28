import { EXPLORER_URL, SOLSCAN_URL } from '@/lib/constants';

const links = {
  token: [
    { label: 'Solana Explorer', href: EXPLORER_URL },
    { label: 'Solscan', href: SOLSCAN_URL },
    { label: 'Tokenomics', href: '/tokenomics' },
    { label: 'Whitepaper', href: '/whitepaper' },
  ],
  ecosystem: [
    { label: 'RevealUI', href: 'https://revealui.com' },
    { label: 'Documentation', href: 'https://docs.revealui.com' },
    { label: 'GitHub', href: 'https://github.com/RevealUIStudio' },
    { label: 'Explorer', href: '/explorer' },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-border bg-gray-950 text-gray-400">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-3">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 text-white">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-sm font-bold">
                R
              </div>
              <span className="text-lg font-bold">RevealCoin</span>
            </div>
            <p className="mt-4 text-sm leading-6">
              The native utility, governance, and reward token for the RevealUI ecosystem. Built on
              Solana Token-2022.
            </p>
          </div>

          {/* Token Links */}
          <div>
            <h3 className="text-sm font-semibold text-white">Token</h3>
            <ul className="mt-4 space-y-3">
              {links.token.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-sm transition-colors hover:text-white"
                    {...(link.href.startsWith('http')
                      ? { target: '_blank', rel: 'noopener noreferrer' }
                      : {})}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Ecosystem Links */}
          <div>
            <h3 className="text-sm font-semibold text-white">Ecosystem</h3>
            <ul className="mt-4 space-y-3">
              {links.ecosystem.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-sm transition-colors hover:text-white"
                    {...(link.href.startsWith('http')
                      ? { target: '_blank', rel: 'noopener noreferrer' }
                      : {})}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-gray-800 pt-8 text-center text-xs">
          <p>&copy; {new Date().getFullYear()} RevealUI Studio. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
