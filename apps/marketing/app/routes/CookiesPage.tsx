import { LegalPageShell } from '../components/LegalPageShell';
import { LegalSections } from '../components/LegalSections';
import { COOKIES_META, COOKIES_SECTIONS } from '../content/legal/cookies';
import { SITE } from '../content/site';

export function CookiesPage() {
  return (
    <LegalPageShell
      title={COOKIES_META.title}
      lastUpdated={COOKIES_META.lastUpdated}
      intro={COOKIES_META.intro}
      notice={{
        variant: COOKIES_META.notice.variant,
        title: COOKIES_META.notice.title,
        body: (
          <>
            {COOKIES_META.notice.body}{' '}
            <a href={`mailto:${SITE.emails.support}`}>{SITE.emails.support}</a>.
          </>
        ),
      }}
    >
      <LegalSections sections={COOKIES_SECTIONS} />
    </LegalPageShell>
  );
}
