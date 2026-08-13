import {
  type BlockAnnotation,
  Button,
  fieldAttrs,
  MarketingSection,
  SectionHeader,
} from '@revealui/presentation';
import { Footer } from '../components/Footer';
import { FrontierPathway } from '../components/landing/FrontierPathway';
import { ProviderSwitch } from '../components/landing/ProviderSwitch';
import { LOCAL_AI_SECTION } from '../content/local-ai';
import {
  LOCAL_AI_FALLBACK_BLOCKS,
  type LocalAiCtaData,
  type LocalAiHeroData,
  type LocalAiMarketProofData,
  type LocalAiNotesData,
  type LocalAiPillarsData,
  localAiCtaSlot,
  localAiHeroSlot,
  localAiMarketProofSlot,
  localAiNotesSlot,
  localAiPillarsSlot,
} from '../lib/page-blocks';
import { useMarketingPageBlocks } from '../lib/use-page-blocks';

// index.css:80-92 remaps emerald-* to cobalt oklch values (Cobalt v5 palette
// remap); this renders cobalt today, not emerald.
const SNIPPET_CODE_CLASS_NAME = 'text-emerald-400'; // adherence-ignore: emerald-utility - zero visual change, see comment above

interface LocalAiHeroProps {
  data: LocalAiHeroData;
  path: string;
  annotation: BlockAnnotation;
}

function LocalAiHero({ data, path, annotation }: LocalAiHeroProps) {
  return (
    <MarketingSection
      tone="background"
      density="spacious"
      width="narrow"
      className="relative overflow-hidden"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-primary/10 via-background to-background"
      />
      <p
        className="text-sm font-semibold uppercase tracking-wide text-primary"
        {...fieldAttrs(annotation, `${path}.eyebrow`)}
      >
        {data.eyebrow}
      </p>
      <h1
        className="mt-4 font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl"
        {...fieldAttrs(annotation, `${path}.title`)}
      >
        {data.h1}
      </h1>
      <p
        className="mt-6 text-lg leading-8 text-body"
        {...fieldAttrs(annotation, `${path}.subtitle`)}
      >
        {data.lead}
      </p>
    </MarketingSection>
  );
}

interface LocalAiPillarsProps {
  data: LocalAiPillarsData;
  path: string;
  annotation: BlockAnnotation;
}

function LocalAiPillars({ data, path, annotation }: LocalAiPillarsProps) {
  return (
    <MarketingSection tone="background" density="compact" width="default">
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-3">
        {data.pillars.map((pillar, index) => (
          <div
            key={`pillar-${index}`}
            className="rounded-2xl bg-card p-6 ring-1 ring-border sm:p-8"
          >
            <h2
              className="font-display text-lg font-semibold tracking-tight text-foreground"
              {...fieldAttrs(annotation, `${path}.items.${index}.label`)}
            >
              {pillar.title}
            </h2>
            <p
              className="mt-3 text-sm leading-6 text-body"
              {...fieldAttrs(annotation, `${path}.items.${index}.body`)}
            >
              {pillar.body}
            </p>
          </div>
        ))}
      </div>
    </MarketingSection>
  );
}

interface LocalAiSnippetProps {
  caption: string;
  captionPath: string;
  annotation: BlockAnnotation;
}

function LocalAiSnippet({ caption, captionPath, annotation }: LocalAiSnippetProps) {
  return (
    <MarketingSection tone="background" density="compact" width="narrow">
      <div className="rounded-2xl bg-foreground p-6 ring-1 ring-background/10">
        <ul className="list-none space-y-2 p-0 font-mono text-sm">
          {LOCAL_AI_SECTION.snippet.lines.map((line) => (
            <li
              key={line.code}
              className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3"
            >
              <code className={SNIPPET_CODE_CLASS_NAME}>{line.code}</code>
              <span className="text-background/60"># {line.note}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-3 text-sm text-muted-foreground" {...fieldAttrs(annotation, captionPath)}>
        {caption}
      </p>
    </MarketingSection>
  );
}

interface LocalAiMarketProofProps {
  data: LocalAiMarketProofData;
  path: string;
  annotation: BlockAnnotation;
}

function LocalAiMarketProof({ data, path, annotation }: LocalAiMarketProofProps) {
  return (
    <MarketingSection tone="background" density="compact" width="narrow">
      <SectionHeader
        eyebrow={<span {...fieldAttrs(annotation, `${path}.eyebrow`)}>{data.eyebrow}</span>}
        eyebrowTone="primary"
        title={<span {...fieldAttrs(annotation, `${path}.heading`)}>{data.heading}</span>}
        description={<span {...fieldAttrs(annotation, `${path}.body`)}>{data.body}</span>}
        align="start"
        titleClassName="text-2xl sm:text-3xl"
      />
      <ul className="mt-12 list-none space-y-4 p-0 sm:mt-14">
        {data.adopters.map((adopter, index) => (
          <li key={`adopter-${index}`} className="rounded-2xl bg-card p-6 ring-1 ring-border">
            <p className="text-base leading-7 text-body">
              <span
                className="font-semibold text-foreground"
                {...fieldAttrs(annotation, `${path}.items.${index}.label`)}
              >
                {adopter.name}
              </span>{' '}
              <span {...fieldAttrs(annotation, `${path}.items.${index}.body`)}>
                {adopter.detail}
              </span>
            </p>
            <p
              className="mt-1 text-xs text-muted-foreground"
              {...fieldAttrs(annotation, `${path}.items.${index}.title`)}
            >
              {adopter.source}
            </p>
          </li>
        ))}
      </ul>
      <p
        className="mt-6 text-sm italic leading-6 text-body"
        {...fieldAttrs(annotation, `${path}.items.${data.adopters.length}.body`)}
      >
        {data.disclaimer}
      </p>
    </MarketingSection>
  );
}

interface LocalAiNotesProps {
  data: LocalAiNotesData;
  path: string;
  annotation: BlockAnnotation;
}

function LocalAiNotes({ data, path, annotation }: LocalAiNotesProps) {
  // Item indices match localAiNotesBlock order: dogfood, honesty, roadmap, snippet-caption.
  return (
    <MarketingSection tone="background" density="compact" width="narrow">
      <div className="space-y-6">
        <p
          className="text-base leading-7 text-body"
          {...fieldAttrs(annotation, `${path}.items.0.body`)}
        >
          {data.dogfood}
        </p>
        <div className="rounded-2xl bg-card p-6 ring-1 ring-border">
          <p
            className="text-sm font-semibold uppercase tracking-widest text-muted-foreground"
            {...fieldAttrs(annotation, `${path}.items.2.title`)}
          >
            {data.roadmapHeading}
          </p>
          <p className="mt-2 text-sm leading-6 text-body">
            <span {...fieldAttrs(annotation, `${path}.items.2.body`)}>{data.roadmapBody}</span>{' '}
            <a href={data.roadmapHref} className="font-medium text-primary hover:underline">
              See the roadmap
            </a>
            .
          </p>
        </div>
        <p
          className="border-t border-border pt-6 text-sm leading-6 text-body"
          {...fieldAttrs(annotation, `${path}.items.1.body`)}
        >
          {data.honesty}
        </p>
      </div>
    </MarketingSection>
  );
}

interface LocalAiCtaProps {
  data: LocalAiCtaData;
  path: string;
  annotation: BlockAnnotation;
}

function LocalAiCta({ data, path, annotation }: LocalAiCtaProps) {
  return (
    <MarketingSection tone="background" density="default" width="narrow">
      <div className="flex flex-col items-start gap-4 sm:flex-row">
        <Button asChild size="lg" variant="brand">
          <a href={data.primary.href} {...fieldAttrs(annotation, `${path}.links.0.label`)}>
            {data.primary.label}
          </a>
        </Button>
        <Button asChild size="lg" appearance="outline" variant="neutral">
          <a
            href={data.secondary.href}
            target="_blank"
            rel="noopener noreferrer"
            {...fieldAttrs(annotation, `${path}.links.1.label`)}
          >
            {data.secondary.label}
          </a>
        </Button>
      </div>
    </MarketingSection>
  );
}

/**
 * Standalone /local-ai page (positioning decision c: standalone, not folded in).
 * Prose sections are CMS-wired via useMarketingPageBlocks (VES P2). Interactive
 * ProviderSwitch / FrontierPathway and env-code snippet lines stay static.
 */
export function LocalAiPage() {
  const { blocks, annotation } = useMarketingPageBlocks('local-ai', LOCAL_AI_FALLBACK_BLOCKS);
  const hero = localAiHeroSlot(blocks);
  const pillars = localAiPillarsSlot(blocks);
  const marketProof = localAiMarketProofSlot(blocks);
  const notes = localAiNotesSlot(blocks);
  const cta = localAiCtaSlot(blocks);

  return (
    <div className="min-h-screen bg-background">
      <LocalAiHero data={hero.data} path={hero.path} annotation={annotation} />
      <LocalAiPillars data={pillars.data} path={pillars.path} annotation={annotation} />
      <LocalAiSnippet
        caption={notes.data.snippetCaption}
        captionPath={`${notes.path}.items.3.body`}
        annotation={annotation}
      />
      <MarketingSection tone="background" density="compact" width="default">
        <ProviderSwitch />
        <FrontierPathway />
      </MarketingSection>
      <LocalAiMarketProof data={marketProof.data} path={marketProof.path} annotation={annotation} />
      <LocalAiNotes data={notes.data} path={notes.path} annotation={annotation} />
      <LocalAiCta data={cta.data} path={cta.path} annotation={annotation} />
      <Footer />
    </div>
  );
}
