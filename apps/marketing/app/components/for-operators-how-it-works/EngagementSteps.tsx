import { type BlockAnnotation, fieldAttrs } from '@revealui/presentation';
import { FO_HIW_STEPS } from '../../content/for-operators-how-it-works';
import type { FoHiwStepsData } from '../../lib/page-blocks';

interface EngagementStepsProps {
  data?: FoHiwStepsData;
  path?: string;
  annotation?: BlockAnnotation;
}

export function EngagementSteps({ data = FO_HIW_STEPS, path, annotation }: EngagementStepsProps) {
  const field = (suffix: string) =>
    annotation && path ? fieldAttrs(annotation, `${path}.${suffix}`) : {};

  return (
    <section className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p
            className="text-sm font-semibold uppercase tracking-widest text-muted-foreground"
            {...field('eyebrow')}
          >
            {data.eyebrow}
          </p>
          <h2
            className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
            {...field('heading')}
          >
            {data.heading}
          </h2>
        </div>

        <ol className="mx-auto mt-16 grid max-w-4xl grid-cols-1 gap-6 list-none p-0">
          {data.steps.map((step, index) => (
            <li
              key={step.number}
              className="grid grid-cols-[auto_1fr] gap-6 rounded-2xl border border-border bg-card p-6 shadow-sm"
            >
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 font-mono text-base font-semibold text-primary"
                {...field(`items.${index}.label`)}
              >
                {step.number}
              </div>
              <div>
                <h3
                  className="text-lg font-semibold leading-7 text-foreground"
                  {...field(`items.${index}.title`)}
                >
                  {step.title}
                </h3>
                <p
                  className="mt-2 text-base leading-7 text-muted-foreground"
                  {...field(`items.${index}.body`)}
                >
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
