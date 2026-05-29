import { FO_HIW_TIMELINE } from '../../content/for-operators-how-it-works';

export function Timeline() {
  return (
    <section className="bg-muted py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-6 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          {FO_HIW_TIMELINE.eyebrow}
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {FO_HIW_TIMELINE.heading}
        </h2>

        <p className="mt-6 text-base leading-7 text-muted-foreground">
          {FO_HIW_TIMELINE.paragraph1}
        </p>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          {FO_HIW_TIMELINE.paragraph2}
        </p>
      </div>
    </section>
  );
}
