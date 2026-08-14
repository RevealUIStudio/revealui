import { LegalPageShell } from '../components/LegalPageShell';
import { LegalSections } from '../components/LegalSections';
import { SLA_META, SLA_SECTIONS } from '../content/legal/sla';

export function SlaPage() {
  return (
    <LegalPageShell
      title={SLA_META.title}
      lastUpdated={SLA_META.lastUpdated}
      intro={SLA_META.intro}
      notice={{
        variant: SLA_META.notice.variant,
        title: SLA_META.notice.title,
        body: (
          <>
            {SLA_META.notice.body} <a href="/status">Open the status page</a>.
          </>
        ),
      }}
    >
      <LegalSections sections={SLA_SECTIONS} />
    </LegalPageShell>
  );
}
