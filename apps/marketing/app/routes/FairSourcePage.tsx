import {
  type BlockAnnotation,
  Button,
  fieldAttrs,
  IconCheckCircle,
  IconPlus,
  IconXCircle,
} from '@revealui/presentation';
import { useEffect } from 'react';
import { Footer } from '../components/Footer';
import {
  FAIR_SOURCE_HERO,
  FAIR_SOURCE_PACKAGES,
  FAIR_SOURCE_PAGE_TITLE,
} from '../content/fair-source';
import { buildOgUrl } from '../lib/og';
import {
  FAIR_SOURCE_FALLBACK_BLOCKS,
  type FairSourceClockData,
  type FairSourceContractData,
  type FairSourceCtaData,
  type FairSourceFaqData,
  type FairSourcePackagesIntroData,
  type FairSourcePeersData,
  fairSourceClockSlot,
  fairSourceContractSlot,
  fairSourceCtaSlot,
  fairSourceFaqSlot,
  fairSourcePackagesIntroSlot,
  fairSourcePeersSlot,
} from '../lib/page-blocks';
import { useMarketingPageBlocks } from '../lib/use-page-blocks';

interface AnnotatedSectionProps {
  path: string;
  annotation: BlockAnnotation;
}

interface ContractProps extends AnnotatedSectionProps {
  data: FairSourceContractData;
}

function FairSourceContract({ data, path, annotation }: ContractProps) {
  return (
    <section className="bg-background py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p
            className="text-sm font-semibold uppercase tracking-widest text-muted-foreground"
            {...fieldAttrs(annotation, `${path}.eyebrow`)}
          >
            {data.eyebrow}
          </p>
          <h2
            className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
            {...fieldAttrs(annotation, `${path}.heading`)}
          >
            {data.heading}
          </h2>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2">
          {data.cards.map((c, index) => (
            <div
              key={c.title}
              className={`rounded-2xl p-6 ring-1 transition ${
                c.kind === 'yes'
                  ? 'bg-primary/10 ring-primary/20'
                  : 'bg-amber-500/15 ring-amber-500/30'
              }`}
            >
              <div className="flex items-start gap-3">
                {c.kind === 'yes' ? (
                  <IconCheckCircle size="md" className="mt-0.5 flex-shrink-0 text-primary" />
                ) : (
                  <IconXCircle
                    size="md"
                    className="mt-0.5 flex-shrink-0 text-amber-800 dark:text-amber-200"
                  />
                )}
                <div>
                  <h3
                    className="text-lg font-semibold text-foreground"
                    {...fieldAttrs(annotation, `${path}.items.${index}.label`)}
                  >
                    {c.title}
                  </h3>
                  <p
                    className="mt-2 text-sm leading-6 text-muted-foreground"
                    {...fieldAttrs(annotation, `${path}.items.${index}.body`)}
                  >
                    {c.body}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

interface PackagesIntroProps extends AnnotatedSectionProps {
  data: FairSourcePackagesIntroData;
}

function FairSourcePackagesIntro({ data, path, annotation }: PackagesIntroProps) {
  // Inventory table stays structural (name / license / repo / npm). Only the
  // section header + footer prose are CMS-driven so metric/package inventory
  // claims never leave the claim-covered content modules + static table.
  return (
    <section className="bg-secondary py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p
            className="text-sm font-semibold uppercase tracking-widest text-muted-foreground"
            {...fieldAttrs(annotation, `${path}.eyebrow`)}
          >
            {data.eyebrow}
          </p>
          <h2
            className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
            {...fieldAttrs(annotation, `${path}.heading`)}
          >
            {data.heading}
          </h2>
          <p
            className="mt-6 text-base leading-7 text-muted-foreground"
            {...fieldAttrs(annotation, `${path}.body`)}
          >
            {data.body}
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-4xl overflow-hidden rounded-2xl bg-card ring-1 ring-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-6 py-3">Package</th>
                <th className="px-6 py-3">Purpose</th>
                <th className="px-6 py-3">License</th>
                <th className="px-6 py-3">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {FAIR_SOURCE_PACKAGES.map((p) => (
                <tr key={p.name}>
                  <td className="px-6 py-4 font-mono text-sm font-semibold text-foreground">
                    {p.name}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{p.purpose}</td>
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
                      className="text-primary hover:text-primary/80"
                    >
                      GitHub
                    </a>
                    <span className="px-2 text-muted-foreground/40">·</span>
                    <a
                      href={p.npm}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80"
                    >
                      npm
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p
          className="mx-auto mt-6 max-w-2xl text-center text-sm text-muted-foreground"
          {...fieldAttrs(annotation, `${path}.items.0.body`)}
        >
          {data.footer.includes(data.footerCommand) ? (
            <>
              {data.footer.slice(0, data.footer.indexOf(data.footerCommand))}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                {data.footerCommand}
              </code>
              {data.footer.slice(
                data.footer.indexOf(data.footerCommand) + data.footerCommand.length,
              )}
            </>
          ) : (
            data.footer
          )}
        </p>
      </div>
    </section>
  );
}

interface ClockProps extends AnnotatedSectionProps {
  data: FairSourceClockData;
}

function FairSourceClock({ data, path, annotation }: ClockProps) {
  return (
    <section className="bg-background py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p
            className="text-sm font-semibold uppercase tracking-widest text-muted-foreground"
            {...fieldAttrs(annotation, `${path}.eyebrow`)}
          >
            {data.eyebrow}
          </p>
          <h2
            className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
            {...fieldAttrs(annotation, `${path}.heading`)}
          >
            {data.heading}
          </h2>
          <p
            className="mt-6 text-base leading-7 text-muted-foreground"
            {...fieldAttrs(annotation, `${path}.body`)}
          >
            {data.body}
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-3xl">
          <ol className="relative border-l-2 border-primary/20 pl-8">
            {data.steps.map((step, index) => (
              <li key={step.title} className="mb-8 last:mb-0">
                <span
                  className={`absolute -left-2.5 mt-1.5 flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-background ${
                    step.color === 'emerald' ? 'bg-primary' : 'bg-amber-600'
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                </span>
                <h3
                  className="font-semibold text-foreground"
                  {...fieldAttrs(annotation, `${path}.items.${index}.label`)}
                >
                  {step.title}
                </h3>
                <p
                  className="mt-1 text-sm text-muted-foreground"
                  {...fieldAttrs(annotation, `${path}.items.${index}.body`)}
                >
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

interface PeersProps extends AnnotatedSectionProps {
  data: FairSourcePeersData;
}

function FairSourcePeers({ data, path, annotation }: PeersProps) {
  return (
    <section className="bg-secondary py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p
            className="text-sm font-semibold uppercase tracking-widest text-muted-foreground"
            {...fieldAttrs(annotation, `${path}.eyebrow`)}
          >
            {data.eyebrow}
          </p>
          <h2
            className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
            {...fieldAttrs(annotation, `${path}.heading`)}
          >
            {data.heading}
          </h2>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-3">
          {data.peers.map((p, index) => (
            <a
              key={p.name}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-2xl bg-card p-6 ring-1 ring-border no-underline transition hover:ring-border/60"
            >
              <h3
                className="text-lg font-semibold text-foreground"
                {...fieldAttrs(annotation, `${path}.items.${index}.label`)}
              >
                {p.name}
              </h3>
              <p
                className="mt-2 text-sm leading-6 text-muted-foreground"
                {...fieldAttrs(annotation, `${path}.items.${index}.body`)}
              >
                {p.note}
              </p>
              <p className="mt-3 text-xs font-medium text-primary">Read their post &rarr;</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

interface FaqProps extends AnnotatedSectionProps {
  data: FairSourceFaqData;
}

function FairSourceFaq({ data, path, annotation }: FaqProps) {
  return (
    <section className="bg-background py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p
            className="text-sm font-semibold uppercase tracking-widest text-muted-foreground"
            {...fieldAttrs(annotation, `${path}.eyebrow`)}
          >
            {data.eyebrow}
          </p>
          <h2
            className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
            {...fieldAttrs(annotation, `${path}.heading`)}
          >
            {data.heading}
          </h2>
        </div>

        <div className="mx-auto mt-12 max-w-3xl divide-y divide-border">
          {data.items.map((f, index) => (
            <details key={f.question} className="group py-6">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-left">
                <h3
                  className="text-lg font-semibold leading-7 text-foreground"
                  {...fieldAttrs(annotation, `${path}.items.${index}.label`)}
                >
                  {f.question}
                </h3>
                <span className="ml-2 mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition group-open:rotate-45 group-open:bg-primary/10 group-open:text-primary">
                  <IconPlus size="sm" label="Toggle" />
                </span>
              </summary>
              <div
                className="mt-4 pr-9 text-base leading-7 text-muted-foreground"
                {...fieldAttrs(annotation, `${path}.items.${index}.body`)}
              >
                {f.answer}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

interface CtaProps extends AnnotatedSectionProps {
  data: FairSourceCtaData;
}

function FairSourceCta({ data, path, annotation }: CtaProps) {
  return (
    <section className="bg-card py-16 sm:py-24">
      <div className="mx-auto max-w-2xl px-6 lg:px-8 text-center">
        <h2
          className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          {...fieldAttrs(annotation, `${path}.heading`)}
        >
          {data.heading}
        </h2>
        <p
          className="mt-6 text-lg leading-8 text-muted-foreground"
          {...fieldAttrs(annotation, `${path}.body`)}
        >
          {data.body}
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button asChild size="lg" variant="brand">
            <a href={data.primary.href} {...fieldAttrs(annotation, `${path}.links.0.label`)}>
              {data.primary.label}
            </a>
          </Button>
          <Button asChild appearance="outline" variant="neutral" size="lg">
            <a href={data.secondary.href} {...fieldAttrs(annotation, `${path}.links.1.label`)}>
              {data.secondary.label}
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}

/**
 * /fair-source license deep dive. Metric-bearing hero and package inventory
 * table stay static (claims safety). Narrative sections are CMS-wired via
 * useMarketingPageBlocks (VES residual).
 */
export function FairSourcePage() {
  const { blocks, annotation } = useMarketingPageBlocks('fair-source', FAIR_SOURCE_FALLBACK_BLOCKS);
  const contract = fairSourceContractSlot(blocks);
  const packagesIntro = fairSourcePackagesIntroSlot(blocks);
  const clock = fairSourceClockSlot(blocks);
  const peers = fairSourcePeersSlot(blocks);
  const faq = fairSourceFaqSlot(blocks);
  const cta = fairSourceCtaSlot(blocks);

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
    <div className="min-h-screen bg-background">
      {/* Hero — static: headline/subhead/body interpolate METRICS counts */}
      <section className="relative isolate overflow-hidden bg-background px-6 pt-20 pb-16 sm:pt-28 sm:pb-20 lg:px-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 via-background to-background"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[600px] w-[1000px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--rvui-brand-glow),transparent_70%)] blur-2xl"
        />

        <div className="relative mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary mb-6">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle mr-2" />
            {FAIR_SOURCE_HERO.eyebrow}
          </p>
          <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            {FAIR_SOURCE_HERO.headline}
            <span className="block text-primary">{FAIR_SOURCE_HERO.headlineHighlight}</span>
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-xl leading-8 text-muted-foreground sm:text-2xl">
            {FAIR_SOURCE_HERO.subhead}
          </p>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-muted-foreground">
            {/* COUNT: packages-fsl = 5, packages-mit = 21 (of 26 total — see /packages/ in repo) */}
            {FAIR_SOURCE_HERO.body.prefix}{' '}
            <a
              href={FAIR_SOURCE_HERO.body.fslHref}
              className="font-medium text-primary underline decoration-primary/40 underline-offset-4 hover:text-primary/80"
            >
              {FAIR_SOURCE_HERO.body.fslLabel}
            </a>
            {FAIR_SOURCE_HERO.body.suffix}
          </p>
        </div>
      </section>

      <FairSourceContract data={contract.data} path={contract.path} annotation={annotation} />
      <FairSourcePackagesIntro
        data={packagesIntro.data}
        path={packagesIntro.path}
        annotation={annotation}
      />
      <FairSourceClock data={clock.data} path={clock.path} annotation={annotation} />
      <FairSourcePeers data={peers.data} path={peers.path} annotation={annotation} />
      <FairSourceFaq data={faq.data} path={faq.path} annotation={annotation} />
      <FairSourceCta data={cta.data} path={cta.path} annotation={annotation} />
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
