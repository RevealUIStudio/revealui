import { LegalPageShell } from '../components/LegalPageShell';
import { LegalSections } from '../components/LegalSections';
import { REFUND_POLICY_META, REFUND_POLICY_SECTIONS } from '../content/legal/refund-policy';

export function RefundPolicyPage() {
  return (
    <LegalPageShell
      title={REFUND_POLICY_META.title}
      lastUpdated={REFUND_POLICY_META.lastUpdated}
      intro={REFUND_POLICY_META.intro}
      notice={{
        variant: REFUND_POLICY_META.notice.variant,
        title: REFUND_POLICY_META.notice.title,
        body: REFUND_POLICY_META.notice.body,
      }}
    >
      <LegalSections sections={REFUND_POLICY_SECTIONS} />
    </LegalPageShell>
  );
}
