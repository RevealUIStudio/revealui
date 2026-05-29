import { ButtonCVA } from '@revealui/presentation';
import { FO_MANAGED_TODAY } from '../../content/for-operators-managed';

export function Today() {
  return (
    <section className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-6 text-center lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          {FO_MANAGED_TODAY.eyebrow}
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {FO_MANAGED_TODAY.heading}
        </h2>

        <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-muted-foreground">
          {FO_MANAGED_TODAY.body}
        </p>

        <div className="mt-10 flex flex-col items-center gap-4">
          <ButtonCVA asChild size="lg">
            <a
              href={FO_MANAGED_TODAY.primaryCta.href}
              {...(FO_MANAGED_TODAY.primaryCta.external
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {})}
            >
              {FO_MANAGED_TODAY.primaryCta.label}
            </a>
          </ButtonCVA>
          <p className="text-sm">
            <a
              href={FO_MANAGED_TODAY.detailLink.href}
              className="font-medium text-primary hover:underline underline-offset-4"
            >
              {FO_MANAGED_TODAY.detailLink.label}
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
