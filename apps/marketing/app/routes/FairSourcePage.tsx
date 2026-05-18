import { ButtonCVA } from '@revealui/presentation';
import { useEffect } from 'react';
import { Footer } from '../components/Footer';
import {
  FAIR_SOURCE_CONTRACT_CARDS,
  FAIR_SOURCE_CONTRACT_SECTION,
  FAIR_SOURCE_CTA,
  FAIR_SOURCE_CLOCK_SECTION,
  FAIR_SOURCE_FAQ_SECTION,
  FAIR_SOURCE_FAQS,
  FAIR_SOURCE_HERO,
  FAIR_SOURCE_PACKAGES,
  FAIR_SOURCE_PACKAGES_SECTION,
  FAIR_SOURCE_PAGE_TITLE,
  FAIR_SOURCE_PEERS,
  FAIR_SOURCE_PEERS_SECTION,
} from '../content/fair-source';
import { buildOgUrl } from '../lib/og';

export function FairSourcePage() {
  // Per-page OG tag override. Vite SPAs can update <head> at runtime; the
  // crawler signal value is lower than SSR, but most modern crawlers
  // (Twitterbot, Slackbot, Discordbot, LinkedIn, OpenGraph spec consumers)
  // execute JavaScript and pick up the dynamic OG image.
  useEffect(() => {
    document.title = FAIR_SOURCE_PAGE_TITLE;
    const ogImage = buildOgUrl(FAIR_SOURCE_HERO.ogTitle, FAIR_SOURCE_HERO.ogSubtitle);
    setMetaContent('og:image', ogImage);
    setMetaContent('twitter:image', ogImage);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-white px-6 pt-20 pb-16 sm:pt-28 sm:pb-20 lg:px-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-emerald-50/40 via-white to-white"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[600px] w-[1000px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(16,185,129,0.18),rgba(16,185,129,0.04)_60%,transparent_80%)] blur-2xl"
        />

        <div className="relative mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700 mb-6">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle mr-2" />
            {FAIR_SOURCE_HERO.eyebrow}
          </p>
          <h1 className="text-5xl font-bold tracking-tight text-gray-950 sm:text-6xl lg:text-7xl">
            {FAIR_SOURCE_HERO.headline}
            <span className="block text-emerald-700">{FAIR_SOURCE_HERO.headlineHighlight}</span>
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-xl leading-8 text-gray-600 sm:text-2xl">
            {FAIR_SOURCE_HERO.subhead}
          </p>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-gray-600">
            {/* COUNT: packages-fsl = 5, packages-mit = 21 (of 26 total — see /packages/ in repo) */}
            {FAIR_SOURCE_HERO.body.prefix}{' '}
            <a
              href={FAIR_SOURCE_HERO.body.fslHref}
              className="font-medium text-emerald-700 underline decoration-emerald-300 underline-offset-4 hover:text-emerald-800"
            >
              {FAIR_SOURCE_HERO.body.fslLabel}
            </a>{' '}
            &mdash; {FAIR_SOURCE_HERO.body.suffix}
          </p>
        </div>
      </section>

      {/* The contract */}
      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
              {FAIR_SOURCE_CONTRACT_SECTION.eyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
              {FAIR_SOURCE_CONTRACT_SECTION.heading}
            </h2>
          </div>

          <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2">
            {FAIR_SOURCE_CONTRACT_CARDS.map((c) => (
              <div
                key={c.title}
                className={`rounded-2xl p-6 ring-1 transition ${
                  c.kind === 'yes'
                    ? 'bg-emerald-50/40 ring-emerald-200'
                    : 'bg-amber-50/40 ring-amber-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  {c.kind === 'yes' ? (
                    <svg
                      className="mt-0.5 h-6 w-6 flex-shrink-0 text-emerald-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <title>Yes</title>
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="mt-0.5 h-6 w-6 flex-shrink-0 text-amber-700"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <title>One restriction</title>
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-950">{c.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-gray-700">{c.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Which packages */}
      <section className="bg-gray-50 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
              {FAIR_SOURCE_PACKAGES_SECTION.eyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
              {FAIR_SOURCE_PACKAGES_SECTION.heading}
            </h2>
            <p className="mt-6 text-base leading-7 text-gray-600">
              {FAIR_SOURCE_PACKAGES_SECTION.body.prefix}{' '}
              <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-sm text-gray-900">
                {FAIR_SOURCE_PACKAGES_SECTION.body.privatePackage}
              </code>{' '}
              {FAIR_SOURCE_PACKAGES_SECTION.body.suffix}
            </p>
          </div>

          <div className="mx-auto mt-12 max-w-4xl overflow-hidden rounded-2xl bg-white ring-1 ring-gray-950/5">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 text-xs font-semibold uppercase tracking-widest text-gray-500">
                <tr>
                  <th className="px-6 py-3">Package</th>
                  <th className="px-6 py-3">Purpose</th>
                  <th className="px-6 py-3">License</th>
                  <th className="px-6 py-3">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {FAIR_SOURCE_PACKAGES.map((p) => (
                  <tr key={p.name}>
                    <td className="px-6 py-4 font-mono text-sm font-semibold text-gray-950">
                      {p.name}
                    </td>
                    <td className="px-6 py-4 text-gray-700">{p.purpose}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
                        {p.license}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <a
                        href={p.repo}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-700 hover:text-emerald-800"
                      >
                        GitHub
                      </a>
                      <span className="px-2 text-gray-300">·</span>
                      <a
                        href={p.npm}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-700 hover:text-emerald-800"
                      >
                        npm
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-gray-500">
            {FAIR_SOURCE_PACKAGES_SECTION.footer.prefix}{' '}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-700">
              {FAIR_SOURCE_PACKAGES_SECTION.footer.command}
            </code>{' '}
            {FAIR_SOURCE_PACKAGES_SECTION.footer.suffix}
          </p>
        </div>
      </section>

      {/* The two-year clock */}
      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
              {FAIR_SOURCE_CLOCK_SECTION.eyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
              {FAIR_SOURCE_CLOCK_SECTION.heading}
            </h2>
            <p className="mt-6 text-base leading-7 text-gray-600">
              {FAIR_SOURCE_CLOCK_SECTION.body}
            </p>
          </div>

          <div className="mx-auto mt-12 max-w-3xl">
            <ol className="relative border-l-2 border-emerald-200 pl-8">
              {FAIR_SOURCE_CLOCK_SECTION.steps.map((step) => (
                <li key={step.title} className="mb-8 last:mb-0">
                  <span
                    className={`absolute -left-2.5 mt-1.5 flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-white ${
                      step.color === 'emerald' ? 'bg-emerald-600' : 'bg-amber-600'
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  </span>
                  <h3 className="font-semibold text-gray-950">{step.title}</h3>
                  <p className="mt-1 text-sm text-gray-600">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* In good company */}
      <section className="bg-gray-50 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
              {FAIR_SOURCE_PEERS_SECTION.eyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
              {FAIR_SOURCE_PEERS_SECTION.heading}
            </h2>
          </div>

          <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-3">
            {FAIR_SOURCE_PEERS.map((p) => (
              <a
                key={p.name}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-2xl bg-white p-6 ring-1 ring-gray-950/5 no-underline transition hover:ring-gray-950/10"
              >
                <h3 className="text-lg font-semibold text-gray-950">{p.name}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">{p.note}</p>
                <p className="mt-3 text-xs font-medium text-emerald-700">Read their post &rarr;</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
              {FAIR_SOURCE_FAQ_SECTION.eyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
              {FAIR_SOURCE_FAQ_SECTION.heading}
            </h2>
          </div>

          <div className="mx-auto mt-12 max-w-3xl divide-y divide-gray-200">
            {FAIR_SOURCE_FAQS.map((f) => (
              <details key={f.question} className="group py-6">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-left">
                  <h3 className="text-lg font-semibold leading-7 text-gray-950">{f.question}</h3>
                  <span className="ml-2 mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-700 transition group-open:rotate-45 group-open:bg-emerald-50 group-open:text-emerald-700">
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <title>Toggle</title>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 4.5v15m7.5-7.5h-15"
                      />
                    </svg>
                  </span>
                </summary>
                <div className="mt-4 pr-9 text-base leading-7 text-gray-600">{f.answer}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-950 py-16 sm:py-24">
        <div className="mx-auto max-w-2xl px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {FAIR_SOURCE_CTA.heading}
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-400">{FAIR_SOURCE_CTA.body}</p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <ButtonCVA asChild size="lg" className="bg-white text-gray-950 hover:bg-gray-100">
              <a href={FAIR_SOURCE_CTA.primaryHref}>{FAIR_SOURCE_CTA.primaryLabel}</a>
            </ButtonCVA>
            <ButtonCVA
              asChild
              variant="outline"
              size="lg"
              className="border-gray-700 text-gray-300 hover:text-white hover:border-gray-500"
            >
              <a href={FAIR_SOURCE_CTA.secondaryHref}>{FAIR_SOURCE_CTA.secondaryLabel}</a>
            </ButtonCVA>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function setMetaContent(property: string, content: string) {
  const isOg = property.startsWith('og:');
  const selector = isOg ? `meta[property="${property}"]` : `meta[name="${property}"]`;
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    if (isOg) element.setAttribute('property', property);
    else element.setAttribute('name', property);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}
