import { LegalPageShell } from '../components/LegalPageShell';
import { LegalSections } from '../components/LegalSections';
import { HIPAA_META, HIPAA_SECTIONS } from '../content/legal/hipaa';
import { SITE } from '../content/site';

export function HipaaPage() {
  return (
    <LegalPageShell
      title={HIPAA_META.title}
      lastUpdated={HIPAA_META.lastUpdated}
      intro={HIPAA_META.intro}
      notice={{
        variant: HIPAA_META.notice.variant,
        title: HIPAA_META.notice.title,
        body: (
          <>
            {HIPAA_META.notice.body}{' '}
            <a href={`mailto:${SITE.emails.support}`}>{SITE.emails.support}</a>.
          </>
        ),
      }}
    >
      <LegalSections sections={HIPAA_SECTIONS} />
    </LegalPageShell>
  );
}
