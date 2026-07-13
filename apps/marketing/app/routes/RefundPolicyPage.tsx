import { Callout } from '@revealui/presentation';
import { Footer } from '../components/Footer';
import { REFUND_POLICY_META, REFUND_POLICY_SECTIONS } from '../content/legal/refund-policy';

export function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 pt-24 lg:px-8">
        <Callout variant="info" title="The short version">
          Perpetual licenses get a full refund within 14 days of purchase, no questions asked.
          Subscriptions get a full refund on your first month if you cancel within 14 days of your
          first charge. Details below.
        </Callout>
      </div>
      <article className="mx-auto max-w-3xl px-6 pb-24 pt-12 lg:px-8 prose prose-gray">
        <h1>{REFUND_POLICY_META.title}</h1>
        <p className="text-sm text-muted-foreground">
          Last updated: {REFUND_POLICY_META.lastUpdated}
        </p>

        <p>{REFUND_POLICY_META.intro}</p>

        {REFUND_POLICY_SECTIONS.map((section) => (
          <div key={section.heading}>
            <h2>{section.heading}</h2>

            {section.subsections?.map((sub) => (
              <div key={sub.heading}>
                <h3>{sub.heading}</h3>
                {sub.paragraph && <p>{sub.paragraph}</p>}
                {sub.listItems && (
                  <ul>
                    {sub.listItems.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

            {section.listPreamble && <p>{section.listPreamble}</p>}

            {section.listItems && (
              <ul>
                {section.listItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}

            {section.paragraphs?.map((para) =>
              section.contactEmail ? (
                <p key={para}>
                  For questions about a specific order or refund, email{' '}
                  <a href={`mailto:${section.contactEmail}`}>{section.contactEmail}</a>.
                </p>
              ) : (
                <p key={para}>{para}</p>
              ),
            )}
          </div>
        ))}
      </article>
      <Footer />
    </div>
  );
}
