import { FO_MANAGED_PREREQS } from '../../content/for-operators-managed';

export function Prerequisites() {
  return (
    <section className="bg-muted py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-6 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          {FO_MANAGED_PREREQS.eyebrow}
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {FO_MANAGED_PREREQS.heading}
        </h2>

        <p className="mt-6 text-base leading-7 text-muted-foreground">{FO_MANAGED_PREREQS.intro}</p>

        <ul className="mt-6 space-y-4 list-none p-0">
          {FO_MANAGED_PREREQS.prerequisites.map((prereq) => (
            <li
              key={prereq.title}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <h3 className="text-base font-semibold leading-7 text-foreground">{prereq.title}</h3>
              <p className="mt-2 text-base leading-7 text-muted-foreground">{prereq.body}</p>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-base leading-7 text-foreground font-medium">
          {FO_MANAGED_PREREQS.closing}
        </p>
      </div>
    </section>
  );
}
