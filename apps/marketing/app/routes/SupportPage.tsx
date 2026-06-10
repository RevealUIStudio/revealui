import { Callout } from '@revealui/presentation';
import { Footer } from '../components/Footer';
import { SUPPORT_META, SUPPORT_SECTIONS } from '../content/legal/support';
import { SITE } from '../content/site';

export function SupportPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 pt-24 lg:px-8">
        <Callout variant="info" title="One channel for direct support, three for community + docs">
          The fastest path is to check{' '}
          <a className="underline" href={SITE.urls.docs} target="_blank" rel="noopener noreferrer">
            the documentation
          </a>{' '}
          first. For account-specific issues, billing, or anything sensitive, email{' '}
          <a className="underline" href={`mailto:${SITE.emails.support}`}>
            {SITE.emails.support}
          </a>
          . We aim for a substantive reply within 48 business hours (Mon–Fri, U.S. Central).
        </Callout>
      </div>
      <article className="mx-auto max-w-3xl px-6 pb-24 pt-12 lg:px-8 prose prose-gray">
        <h1>{SUPPORT_META.title}</h1>
        <p className="text-sm text-muted-foreground">Last updated: {SUPPORT_META.lastUpdated}</p>

        <p>{SUPPORT_META.intro}</p>

        {SUPPORT_SECTIONS.map((section) => (
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
                  For support questions, email{' '}
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
