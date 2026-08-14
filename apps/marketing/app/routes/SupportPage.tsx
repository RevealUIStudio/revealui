import { LegalPageShell } from '../components/LegalPageShell';
import { LegalSections } from '../components/LegalSections';
import { SUPPORT_META, SUPPORT_SECTIONS } from '../content/legal/support';
import { SITE } from '../content/site';

export function SupportPage() {
  return (
    <LegalPageShell
      title={SUPPORT_META.title}
      lastUpdated={SUPPORT_META.lastUpdated}
      intro={SUPPORT_META.intro}
      notice={{
        variant: SUPPORT_META.notice.variant,
        title: SUPPORT_META.notice.title,
        body: (
          <>
            {SUPPORT_META.notice.body}{' '}
            <a href={SITE.urls.docs} target="_blank" rel="noopener noreferrer">
              Documentation
            </a>
            {' · '}
            <a href={`mailto:${SITE.emails.support}`}>{SITE.emails.support}</a>
            {' · '}
            <a href="/sla">SLA</a>.
          </>
        ),
      }}
    >
      <LegalSections sections={SUPPORT_SECTIONS} />
    </LegalPageShell>
  );
}
