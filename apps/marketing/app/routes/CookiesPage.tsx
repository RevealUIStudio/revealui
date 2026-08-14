import { Callout } from '@revealui/presentation';
import { Footer } from '../components/Footer';
import { COOKIES_META, COOKIES_SECTIONS } from '../content/legal/cookies';
import { SITE } from '../content/site';

export function CookiesPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 pt-24 lg:px-8">
        <Callout variant="info" title="Status: drafted in good faith, pending counsel review">
          This page describes the cookies and similar technologies we actually use today. The
          wording has not yet been reviewed by an attorney. Questions:{' '}
          <a className="underline" href={`mailto:${SITE.emails.support}`}>
            {SITE.emails.support}
          </a>
          .
        </Callout>
      </div>
      <article className="mx-auto max-w-3xl px-6 pb-24 pt-12 lg:px-8 prose prose-gray">
        <h1>{COOKIES_META.title}</h1>
        <p className="text-sm text-muted-foreground">Last updated: {COOKIES_META.lastUpdated}</p>
        <p>{COOKIES_META.intro}</p>
        {COOKIES_SECTIONS.map((section) => (
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
                  Questions about cookies:{' '}
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
