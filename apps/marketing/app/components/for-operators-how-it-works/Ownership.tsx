import { FO_HIW_OWNERSHIP } from '../../content/for-operators-how-it-works';

export function Ownership() {
  return (
    <section className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-6 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          {FO_HIW_OWNERSHIP.eyebrow}
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {FO_HIW_OWNERSHIP.heading}
        </h2>

        <p className="mt-6 text-base leading-7 text-muted-foreground">{FO_HIW_OWNERSHIP.intro}</p>

        <ul className="mt-6 space-y-4 list-none p-0">
          {FO_HIW_OWNERSHIP.claims.map((claim) => (
            <li
              key={claim.title}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <h3 className="text-base font-semibold leading-7 text-foreground">{claim.title}</h3>
              <p className="mt-1 text-base leading-7 text-muted-foreground">{claim.body}</p>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-base leading-7 text-foreground font-medium">
          {FO_HIW_OWNERSHIP.differentiator}
        </p>
      </div>
    </section>
  );
}
