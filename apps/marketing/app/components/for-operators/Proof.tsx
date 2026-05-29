import { FOR_OPERATORS_PROOF } from '../../content/for-operators';

export function Proof() {
  return (
    <section className="bg-muted py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-6 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          {FOR_OPERATORS_PROOF.eyebrow}
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {FOR_OPERATORS_PROOF.heading}
        </h2>

        <p className="mt-6 text-base leading-7 text-muted-foreground">{FOR_OPERATORS_PROOF.body}</p>

        <p className="mt-6 text-base leading-7 text-muted-foreground">
          {FOR_OPERATORS_PROOF.bulletIntro}
        </p>

        <ul className="mt-4 space-y-3 list-disc pl-6 text-base leading-7 text-muted-foreground marker:text-primary">
          {FOR_OPERATORS_PROOF.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>

        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {FOR_OPERATORS_PROOF.links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="font-medium text-primary hover:underline underline-offset-4"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
