import { FOR_OPERATORS_DISCOVERY } from '../../content/for-operators';

export function DiscoveryScopeShip() {
  return (
    <section className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-6 text-center lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          {FOR_OPERATORS_DISCOVERY.eyebrow}
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {FOR_OPERATORS_DISCOVERY.heading}
        </h2>
        <p className="mt-6 text-base leading-7 text-muted-foreground">
          {FOR_OPERATORS_DISCOVERY.body}
        </p>
        <p className="mt-8">
          <a
            href={FOR_OPERATORS_DISCOVERY.link.href}
            className="font-medium text-primary hover:underline underline-offset-4"
          >
            {FOR_OPERATORS_DISCOVERY.link.label}
          </a>
        </p>
      </div>
    </section>
  );
}
