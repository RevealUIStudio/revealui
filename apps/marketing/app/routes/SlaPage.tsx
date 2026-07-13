import { Callout } from '@revealui/presentation';
import { Footer } from '../components/Footer';
import { SLA_META, SLA_SECTIONS } from '../content/legal/sla';

export function SlaPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 pt-24 lg:px-8">
        <Callout variant="info" title="The short version">
          We respond within 24 hours during U.S. business hours, and within 4 hours for anything
          critical. Our license and download infrastructure targets 99% monthly uptime. Live status
          is always at{' '}
          <a className="underline" href="/status">
            revealui.com/status
          </a>
          .
        </Callout>
      </div>
      <article className="mx-auto max-w-3xl px-6 pb-24 pt-12 lg:px-8 prose prose-gray">
        <h1>{SLA_META.title}</h1>
        <p className="text-sm text-muted-foreground">Last updated: {SLA_META.lastUpdated}</p>

        <p>{SLA_META.intro}</p>

        {SLA_SECTIONS.map((section) => (
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
                  For questions about these commitments, email{' '}
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
