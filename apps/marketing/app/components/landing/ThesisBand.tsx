import { HOME_THESIS_BAND } from '../../content/home';

/**
 * Full-width thesis band — a no-card pacing break between the Primitives and
 * What's-shipped card grids. The contrasting `bg-secondary` surface makes it
 * read as a deliberate beat, not another section of cards.
 */
export function ThesisBand() {
  return (
    <section className="bg-secondary py-20 sm:py-24">
      <div className="mx-auto max-w-4xl px-6 text-center lg:px-8">
        <p className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {HOME_THESIS_BAND.line}
        </p>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
          {HOME_THESIS_BAND.sub}
        </p>
      </div>
    </section>
  );
}
