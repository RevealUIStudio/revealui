import type { Metadata } from 'next';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Sponsor RevealUI | Support Open Source',
  description:
    'Help sustain RevealUI development. Sponsor tiers from $5/mo with benefits like priority support, logo placement, and consulting hours.',
  openGraph: {
    title: 'Sponsor RevealUI | Support Open Source',
    description:
      'Help sustain RevealUI development. Sponsor tiers from $5/mo with benefits like priority support, logo placement, and consulting hours.',
    type: 'website',
  },
};

const tiers = [
  {
    name: 'Supporter',
    price: '$5',
    period: '/month',
    emoji: '☕',
    description: 'Buy the maintainers a coffee.',
    benefits: ['Sponsor badge on GitHub profile', 'Shoutout in release notes'],
  },
  {
    name: 'Backer',
    price: '$25',
    period: '/month',
    emoji: '⭐',
    description: 'Support ongoing development.',
    benefits: [
      'All Supporter benefits',
      'Name listed on sponsors page',
      'Early access to roadmap updates',
      'Priority issue responses',
    ],
  },
  {
    name: 'Gold Sponsor',
    price: '$100',
    period: '/month',
    emoji: '🏆',
    description: 'Fund a major feature every quarter.',
    benefits: [
      'All Backer benefits',
      'Logo on README and docs site',
      'Monthly office hours call',
      'Vote on roadmap priorities',
    ],
  },
  {
    name: 'Platinum Sponsor',
    price: '$500',
    period: '/month',
    emoji: '💎',
    description: 'Shape the future of RevealUI.',
    benefits: [
      'All Gold Sponsor benefits',
      'Logo with link on landing page',
      'Dedicated Discourse channel',
      'Direct input on architecture decisions',
      'Custom feature development priority',
    ],
  },
];

export default function SponsorPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
            Sponsor
            <span className="block bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              RevealUI
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-600 sm:text-xl">
            RevealUI is open source and free to use. Your sponsorship helps fund development,
            documentation, and community support.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <a
              href="https://github.com/sponsors/RevealUIStudio"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-blue-600 px-8 py-4 text-base font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
            >
              Sponsor on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Sponsor Tiers */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Sponsorship Tiers
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Every contribution matters. Choose the tier that works for you.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className="relative rounded-2xl bg-white p-8 shadow-lg ring-1 ring-gray-200 hover:ring-blue-300 transition-all"
              >
                <div className="text-4xl mb-4">{tier.emoji}</div>
                <h3 className="text-xl font-bold tracking-tight text-gray-900">{tier.name}</h3>
                <p className="mt-2 text-sm text-gray-600">{tier.description}</p>
                <p className="mt-4 flex items-baseline gap-x-1">
                  <span className="text-4xl font-bold tracking-tight text-gray-900">
                    {tier.price}
                  </span>
                  <span className="text-sm text-gray-600">{tier.period}</span>
                </p>
                <ul className="mt-6 space-y-3">
                  {tier.benefits.map((benefit) => (
                    <li key={benefit} className="flex items-start gap-x-3">
                      <svg
                        className="h-5 w-5 flex-none text-blue-600 mt-0.5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <title>Included</title>
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="text-sm text-gray-600">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-16 text-center">
            <a
              href="https://github.com/sponsors/RevealUIStudio"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-blue-600 px-8 py-4 text-base font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
            >
              Become a Sponsor
            </a>
          </div>
        </div>
      </section>

      {/* Why Sponsor */}
      <section className="bg-gray-50 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl text-center mb-12">
              Where Your Support Goes
            </h2>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                  <svg
                    className="h-8 w-8 text-blue-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <title>Development</title>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5"
                    />
                  </svg>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">Development</h3>
                <p className="mt-2 text-sm text-gray-600">
                  New features, bug fixes, and performance improvements.
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                  <svg
                    className="h-8 w-8 text-blue-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <title>Documentation</title>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
                    />
                  </svg>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">Documentation</h3>
                <p className="mt-2 text-sm text-gray-600">
                  Guides, tutorials, API references, and examples.
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                  <svg
                    className="h-8 w-8 text-blue-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <title>Community</title>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
                    />
                  </svg>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">Community</h3>
                <p className="mt-2 text-sm text-gray-600">
                  Discourse forums, issue triage, code reviews, and mentorship.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
