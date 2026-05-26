import { Footer } from '../components/Footer';
import { TERMS_META, TERMS_SECTIONS } from '../content/legal/terms';

export function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <article className="mx-auto max-w-3xl px-6 py-24 lg:px-8 prose prose-gray">
        <h1>{TERMS_META.title}</h1>
        <p className="text-sm text-muted-foreground">Last updated: {TERMS_META.lastUpdated}</p>

        <p>{TERMS_META.intro}</p>

        {TERMS_SECTIONS.map((section) => (
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
                  For questions about these Terms, contact us at{' '}
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
