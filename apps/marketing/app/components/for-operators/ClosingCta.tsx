import { Button } from '@revealui/presentation';
import { FOR_OPERATORS_CLOSING } from '../../content/for-operators';

export function ClosingCta() {
  return (
    <section className="bg-muted py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-6 text-center lg:px-8">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {FOR_OPERATORS_CLOSING.heading}
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-muted-foreground">
          {FOR_OPERATORS_CLOSING.body}
        </p>

        <div className="mt-10 flex justify-center">
          <Button asChild size="lg">
            <a
              href={FOR_OPERATORS_CLOSING.primaryCta.href}
              {...(FOR_OPERATORS_CLOSING.primaryCta.external
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {})}
            >
              {FOR_OPERATORS_CLOSING.primaryCta.label}
            </a>
          </Button>
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          {FOR_OPERATORS_CLOSING.emailFallback.prefix}
          <a
            href={`mailto:${FOR_OPERATORS_CLOSING.emailFallback.address}`}
            className="font-medium text-primary hover:underline underline-offset-4"
          >
            {FOR_OPERATORS_CLOSING.emailFallback.address}
          </a>
          {FOR_OPERATORS_CLOSING.emailFallback.suffix}
        </p>
      </div>
    </section>
  );
}
