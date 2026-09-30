import { ReceiptCard } from '@revealui/presentation';
import { Footer } from '../components/Footer';
import { Hero } from '../components/landing/Hero';
import { PricingTeaser } from '../components/landing/PricingTeaser';
import { HOME_BENEFITS } from '../content/home';
import {
  RECEIPT_HERO_CAPTION,
  RECEIPT_HERO_INTEGRITY,
  RECEIPT_HERO_LINES,
  RECEIPT_HERO_TITLE,
} from '../content/receipt';
import { useAudienceHead } from '../lib/use-audience-head';

/**
 * Product homepage: one headline, Start free + GitHub, the license quote
 * (defaults to self-host; Studio is an outbound path), the license teaser, slim footer.
 */
export function HomePage() {
  useAudienceHead('technical');
  return (
    <div className="min-h-screen bg-background">
      <Hero />
      <section
        className="mx-auto grid max-w-6xl gap-12 px-6 py-16 lg:grid-cols-2"
        aria-label="What you can build on"
      >
        <div className="space-y-8">
          {HOME_BENEFITS.map((benefit) => (
            <div key={benefit.title}>
              <h2 className="text-2xl font-semibold text-foreground">{benefit.title}</h2>
              <p className="mt-3 leading-7 text-body">{benefit.body}</p>
            </div>
          ))}
        </div>
        <div className="min-w-0">
          <ReceiptCard
            title={RECEIPT_HERO_TITLE}
            lines={[...RECEIPT_HERO_LINES]}
            integrity={RECEIPT_HERO_INTEGRITY}
          />
          <p className="mt-4 text-sm text-muted-foreground">{RECEIPT_HERO_CAPTION.text}</p>
          <a
            className="mt-3 inline-block text-primary hover:underline"
            href={RECEIPT_HERO_CAPTION.link.href}
          >
            {RECEIPT_HERO_CAPTION.link.label}
          </a>
        </div>
      </section>
      <PricingTeaser />
      <Footer />
    </div>
  );
}
