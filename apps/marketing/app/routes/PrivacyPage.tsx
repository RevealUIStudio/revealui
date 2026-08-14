import { LegalPageShell } from '../components/LegalPageShell';
import { LegalSections } from '../components/LegalSections';
import { PRIVACY_META, PRIVACY_SECTIONS } from '../content/legal/privacy';
import { SITE } from '../content/site';

export function PrivacyPage() {
  return (
    <LegalPageShell
      title={PRIVACY_META.title}
      lastUpdated={PRIVACY_META.lastUpdated}
      intro={PRIVACY_META.intro}
      notice={{
        variant: PRIVACY_META.notice.variant,
        title: PRIVACY_META.notice.title,
        body: (
          <>
            {PRIVACY_META.notice.body}{' '}
            <a href={`mailto:${SITE.emails.support}`}>{SITE.emails.support}</a>.
          </>
        ),
      }}
    >
      <LegalSections sections={PRIVACY_SECTIONS} />
    </LegalPageShell>
  );
}
