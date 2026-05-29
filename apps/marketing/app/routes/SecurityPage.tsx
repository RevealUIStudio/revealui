import { Callout } from '@revealui/presentation';
import { Footer } from '../components/Footer';
import { SECURITY_META, SECURITY_SECTIONS } from '../content/legal/security';
import { SITE } from '../content/site';

export function SecurityPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 pt-24 lg:px-8">
        <Callout variant="success" title="Safe-harbor commitment to good-faith researchers">
          If you act in good faith and follow this policy, we will not pursue or support legal
          action against you for your security research. Email{' '}
          <a className="underline" href={`mailto:${SITE.emails.security}`}>
            {SITE.emails.security}
          </a>{' '}
          to report a vulnerability. The machine-readable policy is at{' '}
          <a className="underline" href="/.well-known/security.txt">
            /.well-known/security.txt
          </a>
          .
        </Callout>
      </div>
      <article className="mx-auto max-w-3xl px-6 pb-24 pt-12 lg:px-8 prose prose-gray">
        <h1>{SECURITY_META.title}</h1>
        <p className="text-sm text-muted-foreground">Last updated: {SECURITY_META.lastUpdated}</p>

        <p>{SECURITY_META.intro}</p>

        {SECURITY_SECTIONS.map((section) => (
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
                  For security questions or to submit a report, contact us at{' '}
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
