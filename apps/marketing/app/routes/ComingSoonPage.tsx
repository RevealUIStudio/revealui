import { Footer } from '../components/Footer';
import {
  ROADMAP_CTA,
  ROADMAP_CTA_LINKS,
  ROADMAP_CTA_PRODUCTS_LINK,
  ROADMAP_HERO,
  ROADMAP_HERO_LINK,
  ROADMAP_SHIPPED,
  ROADMAP_SHIPPED_SECTION,
  ROADMAP_UPCOMING,
  ROADMAP_UPCOMING_SECTION,
  type RoadmapItem,
} from '../content/roadmap';

const categoryColors: Record<string, string> = {
  payments: 'bg-amber-100 text-amber-700',
  billing: 'bg-purple-100 text-purple-700',
  ai: 'bg-violet-100 text-violet-700',
  infrastructure: 'bg-blue-100 text-blue-700',
  docs: 'bg-emerald-100 text-emerald-700',
  product: 'bg-pink-100 text-pink-700',
  enterprise: 'bg-gray-100 text-gray-700',
};

function statusBadgeClass(status: string): string {
  if (status === 'Shipped' || status === 'Available') {
    return 'text-emerald-700 bg-emerald-50 ring-emerald-200';
  }
  return 'text-amber-700 bg-amber-50 ring-amber-200';
}

function FeatureCard({ feature }: { feature: RoadmapItem }) {
  return (
    <div className="rounded-2xl bg-white p-8 shadow-lg ring-1 ring-gray-200">
      <div className="flex items-center gap-3 mb-4">
        <span
          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${categoryColors[feature.category.toLowerCase()] ?? 'bg-gray-100 text-gray-700'}`}
        >
          {feature.category}
        </span>
        <span
          className={`text-xs font-medium px-2.5 py-0.5 rounded-full ring-1 ${statusBadgeClass(feature.status)}`}
        >
          {feature.status}
        </span>
      </div>
      <h3 className="text-lg font-bold tracking-tight text-gray-900">{feature.name}</h3>
      <p className="mt-3 text-sm leading-6 text-gray-600">{feature.description}</p>
    </div>
  );
}

export function ComingSoonPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <section className="relative overflow-hidden bg-gradient-to-br from-amber-50 via-white to-orange-50 px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
            Product
            <span className="block bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
              Roadmap
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-600 sm:text-xl">
            {ROADMAP_HERO.subtitle} See our{' '}
            <a
              href={ROADMAP_HERO_LINK.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-700 underline hover:text-amber-600"
            >
              {ROADMAP_HERO_LINK.label}
            </a>{' '}
            for the full timeline.
          </p>
        </div>
      </section>

      {/* Recently Shipped */}
      <section className="py-16 sm:py-20 bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl mb-8">
            {ROADMAP_SHIPPED_SECTION.title}
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {ROADMAP_SHIPPED.map((feature) => (
              <FeatureCard key={feature.name} feature={feature} />
            ))}
          </div>
        </div>
      </section>

      {/* Coming Next */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl mb-8">
            {ROADMAP_UPCOMING_SECTION.title}
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {ROADMAP_UPCOMING.map((feature) => (
              <FeatureCard key={feature.name} feature={feature} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-4xl px-6 text-center lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            {ROADMAP_CTA.title}
          </h2>
          <p className="mt-4 text-lg text-gray-600">{ROADMAP_CTA.subtitle}</p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={ROADMAP_CTA_LINKS.requestFeature.href}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-gray-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 transition-colors"
            >
              {ROADMAP_CTA_LINKS.requestFeature.label}
            </a>
            <a
              href={ROADMAP_CTA_LINKS.joinDiscussion.href}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-white px-6 py-3 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50 transition-colors"
            >
              {ROADMAP_CTA_LINKS.joinDiscussion.label}
            </a>
          </div>
          <p className="mt-8 text-sm text-gray-500">
            See what's shipped today &rarr;{' '}
            <a
              href={ROADMAP_CTA_PRODUCTS_LINK.href}
              className="font-medium text-gray-700 hover:text-gray-900 transition-colors"
            >
              {ROADMAP_CTA_PRODUCTS_LINK.label}
            </a>
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
