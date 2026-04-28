import { ButtonCVA } from '@revealui/presentation';
import { useEffect } from 'react';
import { Footer } from '../components/Footer';
import { buildOgUrl } from '../lib/og';

const PAGE_TITLE = 'Fair Source — RevealUI';

const contractCards = [
  {
    kind: 'yes' as const,
    title: 'Use it commercially',
    body: 'Ship Fair Source code in your product, charge customers, run it in production. No royalties, no per-seat fees, no usage caps.',
  },
  {
    kind: 'yes' as const,
    title: 'Read and modify the source',
    body: 'Every line is on GitHub. Fork it, patch it, audit it for security. The source is the source of truth — there is no closed binary hiding behind it.',
  },
  {
    kind: 'yes' as const,
    title: 'Self-host on your own infra',
    body: 'Run it in your VPC, on bare metal, or air-gapped. RevealUI does not phone home and does not depend on a vendor service to function.',
  },
  {
    kind: 'no' as const,
    title: 'Build a competing developer platform',
    body: 'You cannot ship a substantially similar developer platform that competes with RevealUI on top of these packages. This is the only restriction. After two years, even this restriction lifts and the release becomes plain MIT.',
  },
];

const packages = [
  {
    name: '@revealui/ai',
    purpose: 'AI agents, CRDT memory, LLM provider abstractions, orchestration',
    license: 'FSL-1.1-MIT',
    repo: 'https://github.com/RevealUIStudio/revealui/tree/main/packages/ai',
    npm: 'https://www.npmjs.com/package/@revealui/ai',
  },
  {
    name: '@revealui/harnesses',
    purpose: 'AI harness adapters, workboard coordination, JSON-RPC primitives',
    license: 'FSL-1.1-MIT',
    repo: 'https://github.com/RevealUIStudio/revealui/tree/main/packages/harnesses',
    npm: 'https://www.npmjs.com/package/@revealui/harnesses',
  },
];

const peers = [
  {
    name: 'Sentry',
    note: 'Application monitoring; flagship FSL adopter (license they originally co-authored with FOSSA).',
    url: 'https://blog.sentry.io/introducing-the-functional-source-license-freedom-without-free-riding/',
  },
  {
    name: 'GitButler',
    note: 'Git client for branch management. FSL across the stack.',
    url: 'https://gitbutler.com/blog/fair-source',
  },
  {
    name: 'Keygen',
    note: 'License management infrastructure; FSL on their core engine.',
    url: 'https://keygen.sh/blog/fair-source/',
  },
];

const faqs = [
  {
    q: 'Is Fair Source open source?',
    a: 'Not in the OSI-approved sense — the non-compete clause means it is "source-available" rather than "open source." But for almost every practical purpose (read, modify, deploy, charge for products built on top), the freedoms match what most builders need from open source. After two years per release, the clause lifts and the code becomes plain MIT, which IS OSI open source.',
  },
  {
    q: 'What counts as a "competing developer platform"?',
    a: 'The license uses the standard FSL definition: a software product with substantially the same functionality as RevealUI that is offered to the same audience as a developer platform. Building a SaaS app for end users that happens to use @revealui/ai under the hood is fine. Building a marketplace for AI-agent tooling on top of @revealui/harnesses and selling it to developers is the case the clause addresses. If you are unsure, email founder@revealui.com — we would rather you ship than worry.',
  },
  {
    q: 'When exactly does each release convert to MIT?',
    a: "Two years after the publish date of that specific release. So today's 0.4.0 release of @revealui/ai becomes MIT on its 2-year anniversary; a future 0.5.0 starts its own clock from its own publish date. Older releases reach MIT first; this is intentional.",
  },
  {
    q: 'Why not just use plain MIT for everything?',
    a: 'The Pro packages represent meaningful R&D investment in agent runtimes and harness coordination. Plain MIT lets a competitor fork the entire stack on day one and undercut the project on price, leaving the studio with no path to sustain the work. Fair Source closes that specific risk while keeping every other freedom you need. It is a deliberate middle path between "everything free, no business model" and "closed proprietary."',
  },
  {
    q: 'How is the Pro tier enforced if the source is visible?',
    a: 'License enforcement is at runtime, not at the source level. Pro packages check RS256-signed license JWTs, gate features per entry point, and validate against the license server every five minutes. FSL is the legal backstop; runtime enforcement is the real protection. Cracking the license is technically possible (you have the source) — but doing so commercially is exactly what the FSL non-compete clause prohibits, with civil remedies available.',
  },
  {
    q: 'What about the rest of the RevealUI packages?',
    a: 'Every other RevealUI package is plain MIT — no non-compete clause, no time limit, fully open source. That is the OSS substrate (auth, content, billing primitives, admin UI, MCP framework, presentation system, etc.). Fair Source applies only to @revealui/ai and @revealui/harnesses today.',
  },
];

export function FairSourcePage() {
  // Per-page OG tag override. Vite SPAs can update <head> at runtime; the
  // crawler signal value is lower than SSR, but most modern crawlers
  // (Twitterbot, Slackbot, Discordbot, LinkedIn, OpenGraph spec consumers)
  // execute JavaScript and pick up the dynamic OG image.
  useEffect(() => {
    document.title = PAGE_TITLE;
    const ogImage = buildOgUrl(
      'Fair Source',
      'Source-visible. Commercially usable. MIT in two years.',
    );
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
            License contract for the Pro packages
          </p>
          <h1 className="text-5xl font-bold tracking-tight text-gray-950 sm:text-6xl lg:text-7xl">
            Fair Source.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-xl leading-8 text-gray-600 sm:text-2xl">
            Source-visible. Commercially usable. MIT in two years.
          </p>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-gray-600">
            Two RevealUI packages ship under{' '}
            <a
              href="https://fsl.software/"
              className="font-medium text-emerald-700 underline decoration-emerald-300 underline-offset-4 hover:text-emerald-800"
            >
              FSL-1.1-MIT
            </a>{' '}
            instead of plain MIT. The source is on GitHub, commercial use is permitted, and every
            release auto-converts to plain MIT two years after publish. Here is what that means in
            practice.
          </p>
        </div>
      </section>

      {/* The contract */}
      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
              The contract, in plain English
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
              Three yeses and one no.
            </h2>
          </div>

          <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2">
            {contractCards.map((c) => (
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
            <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">Scope</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
              Which RevealUI packages are Fair Source.
            </h2>
            <p className="mt-6 text-base leading-7 text-gray-600">
              Two packages today. Every other package in the suite is plain MIT — no non-compete, no
              time limit, fully open source.
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
                {packages.map((p) => (
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
            Looking for a specific package&rsquo;s license? Run{' '}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-700">
              npm view @revealui/&lt;name&gt; license
            </code>{' '}
            — npm always tells the truth.
          </p>
        </div>
      </section>

      {/* The two-year clock */}
      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
              The two-year clock
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
              Every release auto-converts to MIT.
            </h2>
            <p className="mt-6 text-base leading-7 text-gray-600">
              The 2-year timer starts on each release&rsquo;s publish date. Older releases reach MIT
              first; newer releases start their own clock from their own publish date. The clause
              does not require any action from RevealUI Studio — it is in the license text and
              self-executing.
            </p>
          </div>

          <div className="mx-auto mt-12 max-w-3xl">
            <ol className="relative border-l-2 border-emerald-200 pl-8">
              <li className="mb-8 last:mb-0">
                <span className="absolute -left-2.5 mt-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 ring-4 ring-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                </span>
                <h3 className="font-semibold text-gray-950">Release publishes under FSL-1.1-MIT</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Source on GitHub. Installable from npm. The 2-year clock starts ticking the moment
                  the version tag lands.
                </p>
              </li>
              <li className="mb-8 last:mb-0">
                <span className="absolute -left-2.5 mt-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-600 ring-4 ring-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                </span>
                <h3 className="font-semibold text-gray-950">Year one and year two</h3>
                <p className="mt-1 text-sm text-gray-600">
                  All freedoms apply (use commercially, modify, self-host) except the non-compete
                  clause. You build on it, you ship products with it, you charge customers for those
                  products.
                </p>
              </li>
              <li>
                <span className="absolute -left-2.5 mt-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 ring-4 ring-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                </span>
                <h3 className="font-semibold text-gray-950">Two years later: plain MIT</h3>
                <p className="mt-1 text-sm text-gray-600">
                  That specific release auto-converts to plain MIT. The non-compete clause lifts;
                  the license becomes OSI-approved open source.
                </p>
              </li>
            </ol>
          </div>
        </div>
      </section>

      {/* In good company */}
      <section className="bg-gray-50 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
              In good company
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
              The same license model used by serious infrastructure projects.
            </h2>
          </div>

          <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-3">
            {peers.map((p) => (
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
              Common questions
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
              Detailed answers, not lawyer-speak.
            </h2>
          </div>

          <div className="mx-auto mt-12 max-w-3xl divide-y divide-gray-200">
            {faqs.map((f) => (
              <details key={f.q} className="group py-6">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-left">
                  <h3 className="text-lg font-semibold leading-7 text-gray-950">{f.q}</h3>
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
                <div className="mt-4 pr-9 text-base leading-7 text-gray-600">{f.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-950 py-16 sm:py-24">
        <div className="mx-auto max-w-2xl px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Read the spec yourself.
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-400">
            FSL-1.1-MIT is short, plain English, and authored by the FOSSA legal team. Two pages.
            Read it before you ship.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <ButtonCVA asChild size="lg" className="bg-white text-gray-950 hover:bg-gray-100">
              <a href="https://fsl.software/FSL-1.1-MIT.template.md">FSL-1.1-MIT spec text</a>
            </ButtonCVA>
            <ButtonCVA
              asChild
              variant="outline"
              size="lg"
              className="border-gray-700 text-gray-300 hover:text-white hover:border-gray-500"
            >
              <a href="mailto:founder@revealui.com?subject=Fair%20Source%20question">
                Email a license question
              </a>
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
