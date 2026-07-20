import { Button } from '@revealui/presentation';
import { FO_HIW_CLOSING } from '../../content/for-operators-how-it-works';

export function ClosingCta() {
  return (
    <section className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-6 text-center lg:px-8">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {FO_HIW_CLOSING.heading}
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-muted-foreground">
          {FO_HIW_CLOSING.body}
        </p>

        <div className="mt-10 flex justify-center">
          <Button asChild size="lg">
            <a
              href={FO_HIW_CLOSING.primaryCta.href}
              {...(FO_HIW_CLOSING.primaryCta.external
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {})}
            >
              {FO_HIW_CLOSING.primaryCta.label}
            </a>
          </Button>
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          <a
            href={FO_HIW_CLOSING.backLink.href}
            className="hover:text-foreground transition-colors underline decoration-dotted underline-offset-4"
          >
            {FO_HIW_CLOSING.backLink.label}
          </a>
        </p>
      </div>
    </section>
  );
}
