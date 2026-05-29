import { FO_MANAGED_STATUS } from '../../content/for-operators-managed';

export function Status() {
  return (
    <section className="bg-muted py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-6 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          {FO_MANAGED_STATUS.eyebrow}
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {FO_MANAGED_STATUS.heading}
        </h2>

        <div className="mt-8 space-y-6 text-base leading-7 text-muted-foreground">
          <p>{FO_MANAGED_STATUS.paragraph1}</p>
          <p>{FO_MANAGED_STATUS.paragraph2}</p>
          <p>{FO_MANAGED_STATUS.paragraph3}</p>
        </div>
      </div>
    </section>
  );
}
