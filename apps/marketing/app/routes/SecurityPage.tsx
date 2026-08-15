import { LegalPageShell } from '../components/LegalPageShell';
import { LegalSections } from '../components/LegalSections';
import { SECURITY_META, SECURITY_SECTIONS } from '../content/legal/security';
import { SITE } from '../content/site';

export function SecurityPage() {
  return (
    <LegalPageShell
      title={SECURITY_META.title}
      lastUpdated={SECURITY_META.lastUpdated}
      intro={SECURITY_META.intro}
      notice={{
        variant: SECURITY_META.notice.variant,
        title: SECURITY_META.notice.title,
        body: (
          <>
            {SECURITY_META.notice.body}{' '}
            <a href={`mailto:${SITE.emails.security}`}>{SITE.emails.security}</a>
            {' · '}
            <a href="/.well-known/security.txt">/.well-known/security.txt</a>
          </>
        ),
      }}
    >
      <LegalSections sections={SECURITY_SECTIONS} />
    </LegalPageShell>
  );
}
