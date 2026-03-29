import { BuiltWithRevealUI } from '@revealui/presentation';
import Link from 'next/link';
import { NewsletterSignup } from './NewsletterSignup';

export function Footer() {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="bg-gray-950 border-t border-gray-800 py-12">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <div className="text-2xl font-bold tracking-tight text-white mb-4">RevealUI</div>
            <p className="text-gray-400 text-sm leading-6 max-w-sm">
              Business Operating System Software (B.O.S.S.). Users, content, products, payments, and
              AI — pre-wired, open source, and ready to deploy.
            </p>
            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                Stay in the loop
              </p>
              <NewsletterSignup />
              <p className="mt-2 text-xs text-gray-400">
                Product updates and engineering insights. No spam.
              </p>
            </div>
            <div className="mt-6 flex gap-4">
              <a
                href="https://github.com/RevealUIStudio/revealui"
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="GitHub"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <title>GitHub</title>
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
              <a
                href="https://x.com/revealui"
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="RevealUI on X"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <title>X (Twitter)</title>
                  <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
                </svg>
              </a>
              <a
                href="https://www.linkedin.com/company/revealui"
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="RevealUI on LinkedIn"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <title>LinkedIn</title>
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">
              Product
            </h3>
            <ul className="space-y-3 text-sm text-gray-400">
              <li>
                <Link href="/" className="hover:text-white transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-white transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link
                  href="https://docs.revealui.com"
                  className="hover:text-white transition-colors"
                >
                  Documentation
                </Link>
              </li>
              <li>
                <Link
                  href="https://docs.revealui.com/docs/REFERENCE"
                  className="hover:text-white transition-colors"
                >
                  API Reference
                </Link>
              </li>
              <li>
                <Link href="/blog" className="hover:text-white transition-colors">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="/coming-soon" className="hover:text-white transition-colors">
                  Coming Soon
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">
              Community
            </h3>
            <ul className="space-y-3 text-sm text-gray-400">
              <li>
                <a
                  href="https://github.com/RevealUIStudio/revealui"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/RevealUIStudio/revealui/discussions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Discussions
                </a>
              </li>
              <li>
                <a
                  href="https://revnation.discourse.group"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Forum
                </a>
              </li>
              <li>
                <Link href="/sponsor" className="hover:text-white transition-colors">
                  Sponsor
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-white transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-gray-400 text-sm">
          <div className="flex items-center gap-4">
            <p>&copy; {currentYear} RevealUI Studio. All rights reserved.</p>
            <BuiltWithRevealUI size="sm" colorScheme="dark" />
          </div>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
