import { SERVICE_OFFERINGS } from '@revealui/contracts/pricing';
import type { Metadata } from 'next';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Services | RevealUI',
  description:
    'Expert help for your RevealUI project. Architecture reviews, migration assistance, launch packages, and one-on-one consulting.',
  openGraph: {
    title: 'Services | RevealUI',
    description:
      'Expert help for your RevealUI project. Architecture reviews, migration assistance, launch packages, and one-on-one consulting.',
    type: 'website',
  },
};

export default function ServicesPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-amber-50 via-white to-orange-50 px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
            Expert help
            <span className="block bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
              when you need it
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-600 sm:text-xl">
            Architecture reviews, migrations, launch support, and one-on-one consulting. Work
            directly with RevealUI engineers who built the platform.
          </p>
        </div>
      </section>

      {/* Services grid */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {SERVICE_OFFERINGS.map((service) => (
              <div
                key={service.id}
                className="rounded-2xl bg-white p-8 shadow-lg ring-1 ring-gray-200"
              >
                <h3 className="text-xl font-bold tracking-tight text-gray-900">{service.name}</h3>
                {service.price && (
                  <p className="mt-2">
                    <span className="text-3xl font-bold text-gray-900">{service.price}</span>
                    {service.priceNote && (
                      <span className="ml-1 text-sm text-gray-500">{service.priceNote}</span>
                    )}
                  </p>
                )}
                <p className="mt-4 text-sm leading-6 text-gray-600">{service.description}</p>
                <ul className="mt-6 space-y-2">
                  {service.includes.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                      <svg
                        className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        role="img"
                        aria-label="Included"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-gray-500 italic">{service.deliverable}</p>
                <a
                  href={service.ctaHref}
                  className="mt-6 block w-full rounded-md bg-amber-700 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-amber-600 transition-colors"
                >
                  {service.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              How it works
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              From first contact to deliverable in three steps.
            </p>
          </div>
          <div className="mx-auto max-w-4xl grid grid-cols-1 gap-8 sm:grid-cols-3">
            {[
              {
                step: '1',
                title: 'Reach out',
                description:
                  'Email services@revealui.com or use the booking links above. Describe your project and what you need help with.',
              },
              {
                step: '2',
                title: 'Scope and schedule',
                description:
                  'We review your requirements, confirm scope and timeline, and schedule the engagement. Consulting hours are available within 48 hours.',
              },
              {
                step: '3',
                title: 'Deliver',
                description:
                  'We deliver the agreed work product: written reports, migration scripts, production deployments, or session recordings with follow-up notes.',
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-lg font-bold text-amber-700">
                  {item.step}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-2xl px-6 text-center lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Not sure what you need?
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Start with a consulting hour. We will help you figure out the right approach for your
            project and recommend next steps.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="mailto:services@revealui.com?subject=Consulting%20Hour"
              className="rounded-md bg-amber-700 px-8 py-4 text-base font-semibold text-white shadow-sm hover:bg-amber-600 transition-colors"
            >
              Book a Consulting Hour
            </a>
            <a
              href="mailto:support@revealui.com"
              className="rounded-md bg-gray-100 px-8 py-4 text-base font-semibold text-gray-900 hover:bg-gray-200 transition-colors"
            >
              Contact Support
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
