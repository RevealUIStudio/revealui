import { Link } from '@revealui/router';
import { PoweredByRevealUI } from './agency/PoweredByRevealUI';

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-200 bg-gray-50">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-950">RevealUI Studio</h3>
            <p className="mt-2 text-sm text-gray-600">
              The agency that builds with RevealUI.
            </p>
            <PoweredByRevealUI className="mt-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-950">Services</h4>
            <ul className="mt-2 space-y-2 text-sm text-gray-600">
              <li>
                <Link to="/services" className="hover:text-gray-950 transition-colors">
                  Forge Stamp
                </Link>
              </li>
              <li>
                <Link to="/services" className="hover:text-gray-950 transition-colors">
                  Custom Build
                </Link>
              </li>
              <li>
                <Link to="/services" className="hover:text-gray-950 transition-colors">
                  AI Integration
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-950">Company</h4>
            <ul className="mt-2 space-y-2 text-sm text-gray-600">
              <li>
                <Link to="/about" className="hover:text-gray-950 transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-gray-950 transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-950">Open source</h4>
            <ul className="mt-2 space-y-2 text-sm text-gray-600">
              <li>
                <a
                  href="https://revealui.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-gray-950 transition-colors"
                >
                  RevealUI platform
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/RevealUIStudio"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-gray-950 transition-colors"
                >
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href="https://docs.revealui.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-gray-950 transition-colors"
                >
                  Documentation
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-gray-200 pt-8 sm:flex-row sm:items-center">
          <p className="text-xs text-gray-500">
            © {year} REVEALUI STUDIO L.L.C. All rights reserved.
          </p>
          <p className="text-xs text-gray-500">
            Tennessee LLC · founder@revealui.com
          </p>
        </div>
      </div>
    </footer>
  );
}
