import { type BlockAnnotation, Button, fieldAttrs } from '@revealui/presentation';
import { Footer } from '../components/Footer';
import {
  PHILOSOPHY_FALLBACK_BLOCKS,
  type PhilosophyBodyData,
  type PhilosophyCtaData,
  type PhilosophyHeroData,
  philosophyBodySlot,
  philosophyCtaSlot,
  philosophyHeroSlot,
} from '../lib/page-blocks';
import { useMarketingPageBlocks } from '../lib/use-page-blocks';

interface PhilosophyHeroProps {
  data: PhilosophyHeroData;
  path: string;
  annotation: BlockAnnotation;
}

function PhilosophyHero({ data, path, annotation }: PhilosophyHeroProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-violet-500/10 px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <p
          className="text-sm font-semibold uppercase tracking-wide text-primary"
          {...fieldAttrs(annotation, `${path}.eyebrow`)}
        >
          {data.eyebrow}
        </p>
        <h1
          className="mt-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl"
          {...fieldAttrs(annotation, `${path}.title`)}
        >
          {data.h1}
        </h1>
      </div>
    </section>
  );
}

interface PhilosophyBodyProps {
  data: PhilosophyBodyData;
  path: string;
  annotation: BlockAnnotation;
}

function PhilosophyBody({ data, path, annotation }: PhilosophyBodyProps) {
  return (
    <section className="px-6 py-16 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-8">
        {data.sections.map((section, index) => {
          if (section.role === 'lead') {
            return (
              <p
                key={`lead-${index}`}
                className="text-2xl font-medium leading-relaxed text-foreground sm:text-3xl"
                {...fieldAttrs(annotation, `${path}.items.${index}.body`)}
              >
                {section.body}
              </p>
            );
          }
          if (section.role === 'footer') {
            return (
              <p
                key={`footer-${index}`}
                className="mt-12 border-t border-border pt-8 text-base font-medium text-muted-foreground"
                {...fieldAttrs(annotation, `${path}.items.${index}.body`)}
              >
                {section.body}
              </p>
            );
          }
          return (
            <p
              key={`body-${index}`}
              className="text-lg leading-8 text-muted-foreground"
              {...fieldAttrs(annotation, `${path}.items.${index}.body`)}
            >
              {section.body}
            </p>
          );
        })}
      </div>
    </section>
  );
}

interface PhilosophyCtaProps {
  data: PhilosophyCtaData;
}

function PhilosophyCta({ data }: PhilosophyCtaProps) {
  // Link labels are editable via the ctaSection block's links in a later
  // media/CTA canvas slice; for now labels ride the block data used by seed.
  return (
    <section className="px-6 pb-24 sm:pb-32 lg:px-8">
      <div className="mx-auto flex max-w-3xl flex-col items-start gap-4 sm:flex-row">
        <Button asChild size="lg" variant="brand">
          <a href={data.primary.href}>{data.primary.label}</a>
        </Button>
        <Button asChild size="lg" appearance="outline" variant="neutral">
          <a href={data.secondary.href} target="_blank" rel="noopener noreferrer">
            {data.secondary.label}
          </a>
        </Button>
      </div>
    </section>
  );
}

export function PhilosophyPage() {
  const { blocks, annotation } = useMarketingPageBlocks('philosophy', PHILOSOPHY_FALLBACK_BLOCKS);
  const hero = philosophyHeroSlot(blocks);
  const body = philosophyBodySlot(blocks);
  const cta = philosophyCtaSlot(blocks);

  return (
    <div className="min-h-screen bg-background">
      <PhilosophyHero data={hero.data} path={hero.path} annotation={annotation} />
      <PhilosophyBody data={body.data} path={body.path} annotation={annotation} />
      <PhilosophyCta data={cta.data} />
      <Footer />
    </div>
  );
}
