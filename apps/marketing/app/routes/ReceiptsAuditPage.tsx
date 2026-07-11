import { Footer } from '../components/Footer';
import { ReceiptsAudit } from '../components/receipts-audit/ReceiptsAudit';
import { RECEIPTS_AUDIT_HERO } from '../content/receipts-audit';

/**
 * /receipts-audit — the Agent Receipts Audit lead magnet. A twelve-question
 * yes/no self-assessment that scores inline, bands the result, and captures an
 * email against the waitlist (source 'receipts-audit') in exchange for the
 * remediation guide, which is revealed on the page after a successful submit.
 *
 * Design direction (owner ruling 2026-07-10): the calmest page in the room.
 * Subtraction-first, generous whitespace, at most one CTA per viewport, Cobalt
 * brand tokens. No banners, no popups, no homepage sections beyond the two
 * quiet placements (footer nav + Problem-section contextual link).
 */
export function ReceiptsAuditPage() {
  return (
    <div className="min-h-screen bg-background">
      <section className="px-6 pt-24 pb-8 sm:pt-32 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            {RECEIPTS_AUDIT_HERO.eyebrow}
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {RECEIPTS_AUDIT_HERO.title}
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            {RECEIPTS_AUDIT_HERO.subhead}
          </p>
        </div>
      </section>

      <ReceiptsAudit />

      <Footer />
    </div>
  );
}
