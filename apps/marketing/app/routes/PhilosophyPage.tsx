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
  path: string;
  annotation: BlockAnnotation;
}

function PhilosophyCta({ data, path, annotation }: PhilosophyCtaProps) {
  return (
    <section className="px-6 pb-24 sm:pb-32 lg:px-8">
      <div className="mx-auto flex max-w-3xl flex-col items-start gap-4 sm:flex-row">
        <Button asChild size="lg" variant="brand">
          <a
            href={data.primary.href}
            {...fieldAttrs(annotation, `${path}.links.0.href`)}
            data-rvui-value={data.primary.href}
          >
            <span {...fieldAttrs(annotation, `${path}.links.0.label`)}>{data.primary.label}</span>
          </a>
        </Button>
        <Button asChild size="lg" appearance="outline" variant="neutral">
          <a
            href={data.secondary.href}
            target="_blank"
            rel="noopener noreferrer"
            {...fieldAttrs(annotation, `${path}.links.1.href`)}
            data-rvui-value={data.secondary.href}
          >
            <span {...fieldAttrs(annotation, `${path}.links.1.label`)}>{data.secondary.label}</span>
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
      <PhilosophyCta data={cta.data} path={cta.path} annotation={annotation} />
      <Footer />
    </div>
  );
}
