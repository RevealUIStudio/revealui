import {
  type BlockAnnotation,
  Button,
  fieldAttrs,
  IconCheckCircle,
  IconPlus,
  IconXCircle,
  MarketingSection,
  SectionHeader,
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
    <MarketingSection tone="background" density="compact" width="default">
      <SectionHeader
        eyebrow={<span {...fieldAttrs(annotation, `${path}.eyebrow`)}>{data.eyebrow}</span>}
        eyebrowTone="muted"
        title={<span {...fieldAttrs(annotation, `${path}.heading`)}>{data.heading}</span>}
        align="center"
      />

      <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-4 sm:mt-14 sm:grid-cols-2">
        {data.cards.map((c, index) => (
          <div
            key={c.title}
            className={`rounded-2xl p-6 ring-1 transition sm:p-8 ${
              c.kind === 'yes' ? 'bg-primary/10 ring-primary/20' : 'bg-muted ring-border'
            }`}
          >
            <div className="flex items-start gap-3">
              {c.kind === 'yes' ? (
                <IconCheckCircle size="md" className="mt-0.5 flex-shrink-0 text-primary" />
              ) : (
                <IconXCircle size="md" className="mt-0.5 flex-shrink-0 text-muted-foreground" />
              )}
              <div>
                <h3
                  className="text-lg font-semibold text-foreground"
                  {...fieldAttrs(annotation, `${path}.items.${index}.label`)}
                >
                  {c.title}
                </h3>
                <p
                  className="mt-2 text-sm leading-6 text-body"
                  {...fieldAttrs(annotation, `${path}.items.${index}.body`)}
                >
                  {c.body}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </MarketingSection>
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
    <MarketingSection tone="secondary" density="compact" width="default">
      <SectionHeader
        eyebrow={<span {...fieldAttrs(annotation, `${path}.eyebrow`)}>{data.eyebrow}</span>}
        eyebrowTone="muted"
        title={<span {...fieldAttrs(annotation, `${path}.heading`)}>{data.heading}</span>}
        description={<span {...fieldAttrs(annotation, `${path}.body`)}>{data.body}</span>}
        align="center"
      />

      <div className="mx-auto mt-12 max-w-4xl overflow-hidden rounded-2xl bg-card ring-1 ring-border sm:mt-14">
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
                  <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary ring-1 ring-primary/20">
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
        className="mx-auto mt-6 max-w-2xl text-center text-sm text-body"
        {...fieldAttrs(annotation, `${path}.items.0.body`)}
      >
        {data.footer.includes(data.footerCommand) ? (
          <>
            {data.footer.slice(0, data.footer.indexOf(data.footerCommand))}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
              {data.footerCommand}
            </code>
            {data.footer.slice(data.footer.indexOf(data.footerCommand) + data.footerCommand.length)}
          </>
        ) : (
          data.footer
        )}
      </p>
    </MarketingSection>
  );
}

interface ClockProps extends AnnotatedSectionProps {
  data: FairSourceClockData;
}

function FairSourceClock({ data, path, annotation }: ClockProps) {
  return (
    <MarketingSection tone="background" density="compact" width="default">
      <SectionHeader
        eyebrow={<span {...fieldAttrs(annotation, `${path}.eyebrow`)}>{data.eyebrow}</span>}
        eyebrowTone="muted"
        title={<span {...fieldAttrs(annotation, `${path}.heading`)}>{data.heading}</span>}
        description={<span {...fieldAttrs(annotation, `${path}.body`)}>{data.body}</span>}
        align="center"
      />

      <div className="mx-auto mt-12 max-w-3xl sm:mt-14">
        <ol className="relative border-l-2 border-primary/20 pl-8">
          {data.steps.map((step, index) => (
            <li key={step.title} className="mb-7 last:mb-0 sm:mb-8">
              <span
                className={`absolute -left-2.5 mt-1.5 flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-background ${
                  step.color === 'emerald' ? 'bg-primary' : 'bg-muted-foreground'
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
                className="mt-1 text-sm text-body"
                {...fieldAttrs(annotation, `${path}.items.${index}.body`)}
              >
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </MarketingSection>
  );
}

interface PeersProps extends AnnotatedSectionProps {
  data: FairSourcePeersData;
}

function FairSourcePeers({ data, path, annotation }: PeersProps) {
  return (
    <MarketingSection tone="secondary" density="compact" width="default">
      <SectionHeader
        eyebrow={<span {...fieldAttrs(annotation, `${path}.eyebrow`)}>{data.eyebrow}</span>}
        eyebrowTone="muted"
        title={<span {...fieldAttrs(annotation, `${path}.heading`)}>{data.heading}</span>}
        align="center"
      />

      <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-4 sm:mt-14 sm:grid-cols-3">
        {data.peers.map((p, index) => (
          <a
            key={p.name}
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-2xl bg-card p-6 ring-1 ring-border no-underline transition hover:ring-border/60 sm:p-8"
          >
            <h3
              className="text-lg font-semibold text-foreground"
              {...fieldAttrs(annotation, `${path}.items.${index}.label`)}
            >
              {p.name}
            </h3>
            <p
              className="mt-2 text-sm leading-6 text-body"
              {...fieldAttrs(annotation, `${path}.items.${index}.body`)}
            >
              {p.note}
            </p>
            <p className="mt-3 text-xs font-medium text-primary">Read their post &rarr;</p>
          </a>
        ))}
      </div>
    </MarketingSection>
  );
}

interface FaqProps extends AnnotatedSectionProps {
  data: FairSourceFaqData;
}

function FairSourceFaq({ data, path, annotation }: FaqProps) {
  return (
    <MarketingSection tone="background" density="compact" width="default">
      <SectionHeader
        eyebrow={<span {...fieldAttrs(annotation, `${path}.eyebrow`)}>{data.eyebrow}</span>}
        eyebrowTone="muted"
        title={<span {...fieldAttrs(annotation, `${path}.heading`)}>{data.heading}</span>}
        align="center"
      />

      <div className="mx-auto mt-12 max-w-3xl divide-y divide-border sm:mt-14">
        {data.items.map((f, index) => (
          <details key={f.question} className="group py-5 sm:py-6">
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
              className="mt-4 pr-9 text-base leading-7 text-body"
              {...fieldAttrs(annotation, `${path}.items.${index}.body`)}
            >
              {f.answer}
            </div>
          </details>
        ))}
      </div>
    </MarketingSection>
  );
}

interface CtaProps extends AnnotatedSectionProps {
  data: FairSourceCtaData;
}

function FairSourceCta({ data, path, annotation }: CtaProps) {
  return (
    <MarketingSection tone="card" density="compact" width="narrow">
      <SectionHeader
        title={<span {...fieldAttrs(annotation, `${path}.heading`)}>{data.heading}</span>}
        description={<span {...fieldAttrs(annotation, `${path}.body`)}>{data.body}</span>}
        align="center"
      />
      <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:mt-14 sm:flex-row">
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
    </MarketingSection>
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
      {/* One quiet wash only (no radial blob + brand-dot chrome). */}
      <MarketingSection
        tone="background"
        density="spacious"
        width="narrow"
        className="relative isolate overflow-hidden"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 via-background to-background"
        />

        <div className="relative text-center">
          <p className="mb-6 text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            {FAIR_SOURCE_HERO.eyebrow}
          </p>
          <h1 className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            {FAIR_SOURCE_HERO.headline}
            <span className="block text-primary">{FAIR_SOURCE_HERO.headlineHighlight}</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-body sm:text-xl">
            {FAIR_SOURCE_HERO.subhead}
          </p>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-body">
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
      </MarketingSection>

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
