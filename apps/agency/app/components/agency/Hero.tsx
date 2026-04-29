import { Link } from '@revealui/router';
import { ComingSoonBadge } from './ComingSoonBadge';

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-white">
      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-32 lg:py-40">
        <div className="hero-stagger max-w-3xl">
          <ComingSoonBadge />
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-gray-950 sm:text-5xl lg:text-6xl">
            We build agent-first business systems with{' '}
            <span className="text-emerald-600">RevealUI</span>.
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            RevealUI Studio is the agency that builds, integrates, and stamps with the open-source
            RevealUI runtime — for engineering teams shipping real AI products. We start where the
            tutorial ends.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              to="/contact"
              className="inline-flex items-center rounded-lg bg-gray-950 px-6 py-3 text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
            >
              Book a discovery call
            </Link>
            <Link
              to="/services"
              className="inline-flex items-center rounded-lg border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-950 hover:bg-gray-50 transition-colors"
            >
              View services →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
