import { FO_MANAGED_WOULD_BE } from '../../content/for-operators-managed';

export function WouldBe() {
  return (
    <section className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            {FO_MANAGED_WOULD_BE.eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {FO_MANAGED_WOULD_BE.heading}
          </h2>
        </div>

        <ul className="mx-auto mt-16 grid max-w-4xl grid-cols-1 gap-6 list-none p-0">
          {FO_MANAGED_WOULD_BE.capabilities.map((capability) => (
            <li
              key={capability.title}
              className="rounded-2xl border border-border bg-card p-6 shadow-sm"
            >
              <h3 className="text-lg font-semibold leading-7 text-foreground">
                {capability.title}
              </h3>
              <p className="mt-2 text-base leading-7 text-muted-foreground">{capability.body}</p>
            </li>
          ))}
        </ul>

        <p className="mx-auto mt-12 max-w-2xl text-center text-base leading-7 text-foreground font-medium">
          {FO_MANAGED_WOULD_BE.closing}
        </p>
      </div>
    </section>
  );
}
