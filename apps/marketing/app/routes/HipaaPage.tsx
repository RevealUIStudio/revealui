import { Callout } from '@revealui/presentation';
import { Footer } from '../components/Footer';
import { HIPAA_META, HIPAA_SECTIONS } from '../content/legal/hipaa';
import { SITE } from '../content/site';

export function HipaaPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 pt-24 lg:px-8">
        <Callout variant="warning" title="Not a certification">
          This page does not claim that RevealUI is HIPAA certified. It describes the technical
          controls in the product and the contract steps that are still required. Counsel questions:{' '}
          <a className="underline" href={`mailto:${SITE.emails.support}`}>
            {SITE.emails.support}
          </a>
          .
        </Callout>
      </div>
      <article className="mx-auto max-w-3xl px-6 pb-24 pt-12 lg:px-8 prose prose-gray">
        <h1>{HIPAA_META.title}</h1>
        <p className="text-sm text-muted-foreground">Last updated: {HIPAA_META.lastUpdated}</p>
        <p>{HIPAA_META.intro}</p>
        {HIPAA_SECTIONS.map((section) => (
          <div key={section.heading}>
            <h2>{section.heading}</h2>
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
                  HIPAA and BAA questions:{' '}
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
