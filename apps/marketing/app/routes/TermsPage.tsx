import { LegalPageShell } from '../components/LegalPageShell';
import { LegalSections } from '../components/LegalSections';
import { TERMS_META, TERMS_SECTIONS } from '../content/legal/terms';
import { SITE } from '../content/site';

export function TermsPage() {
  return (
    <LegalPageShell
      title={TERMS_META.title}
      lastUpdated={TERMS_META.lastUpdated}
      intro={TERMS_META.intro}
      notice={{
        variant: TERMS_META.notice.variant,
        title: TERMS_META.notice.title,
        body: (
          <>
            {TERMS_META.notice.body}{' '}
            <a href={`mailto:${SITE.emails.support}`}>{SITE.emails.support}</a>.
          </>
        ),
      }}
    >
      <LegalSections sections={TERMS_SECTIONS} />
    </LegalPageShell>
  );
}
