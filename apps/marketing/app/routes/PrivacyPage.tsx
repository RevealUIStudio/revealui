import { Callout } from '@revealui/presentation';
import { Footer } from '../components/Footer';
import { PRIVACY_META, PRIVACY_SECTIONS } from '../content/legal/privacy';
import { SITE } from '../content/site';

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 pt-24 lg:px-8">
        <Callout variant="info" title="Status: drafted in good faith, pending counsel review">
          This page describes our actual privacy practices today. The wording has not yet been
          reviewed by an attorney; we disclose this rather than hide it. The substance will not
          change after review. Only the wording may tighten. Privacy questions or data-rights
          requests in the meantime:{' '}
          <a className="underline" href={`mailto:${SITE.emails.support}`}>
            {SITE.emails.support}
          </a>
          .
        </Callout>
      </div>
      <article className="mx-auto max-w-3xl px-6 pb-24 pt-12 lg:px-8 prose prose-gray">
        <h1>{PRIVACY_META.title}</h1>
        <p className="text-sm text-muted-foreground">Last updated: {PRIVACY_META.lastUpdated}</p>

        <p>{PRIVACY_META.intro}</p>

        {PRIVACY_SECTIONS.map((section) => (
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

            {section.thirdParties && (
              <ul>
                {section.thirdParties.map((tp) => (
                  <li key={tp.name}>
                    <strong>{tp.name}</strong>: {tp.description} (
                    <a href={tp.policyUrl}>{tp.policyLabel}</a>){tp.extra ? ` ${tp.extra}` : ''}
                  </li>
                ))}
              </ul>
            )}

            {section.paragraphs?.map((para) =>
              section.contactEmail ? (
                <p key={para}>
                  For privacy-related questions or to exercise your data rights, contact us at{' '}
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
