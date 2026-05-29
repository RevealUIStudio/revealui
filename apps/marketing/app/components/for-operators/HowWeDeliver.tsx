import { FOR_OPERATORS_HOW_WE_DELIVER } from '../../content/for-operators';

export function HowWeDeliver() {
  const { eyebrow, heading, paragraph1, paragraph2, paragraph3 } = FOR_OPERATORS_HOW_WE_DELIVER;

  return (
    <section className="bg-muted py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-6 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          {eyebrow}
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {heading}
        </h2>

        <div className="mt-8 space-y-6 text-base leading-7 text-muted-foreground">
          <p>{paragraph1}</p>
          <p>
            {paragraph2.before}
            <a
              href={paragraph2.linkHref}
              className="font-medium text-primary hover:underline underline-offset-4"
            >
              {paragraph2.linkLabel}
            </a>
            {paragraph2.after}
          </p>
          <p>{paragraph3}</p>
        </div>
      </div>
    </section>
  );
}
