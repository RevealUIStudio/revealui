// Brand-approved REV Guardrail blurb. Agent template / fleet plugin, not a SKU.
// FDE can wire this module onto other surfaces. /templates renders it as a
// labeled card so it is not mistaken for a CLI scaffold or a live paid SKU.
// Runtime skeleton source: templates/rev-guardrail/ (revealui#2858, test target).
// Not indexed in claims-evidence until the enforcer agent has behavior proofs.
// Brand longer line used an em dash; house voice requires a period there.

export interface RevGuardrailBlurb {
  readonly id: 'rev-guardrail';
  readonly kind: 'template-plugin';
  readonly title: string;
  readonly eyebrow: string;
  readonly shortBlurb: string;
  readonly longer: string;
  readonly includes: readonly string[];
  readonly doesNotInclude: readonly string[];
  readonly sku: null;
  /** Repo-relative template source. Not a checkout SKU. */
  readonly sourcePath: 'templates/rev-guardrail';
  readonly sourceLabel: string;
}

export const REV_GUARDRAIL: RevGuardrailBlurb = {
  id: 'rev-guardrail',
  kind: 'template-plugin',
  title: 'REV Guardrail',
  eyebrow: 'Agent template · Fleet plugin',
  shortBlurb:
    'Checks configured overclaim phrases (including fake SOC 2), flags configured ICP phrases, requires Snapshot before Checkpoint, and writes a receipt for every enforcement.',
  longer:
    'REV Guardrail is an enforcer agent for multi-agent fleets on RevealUI. You configure honesty, ICP phrase, and Snapshot-before-Checkpoint checks. Lane ownership and offer pricing are illustrative fields, not evaluated controls. You run it on your runtime. It is a template, not a hosted chatbot.',
  includes: [
    'configured overclaim phrase checks',
    'configured ICP phrase checks',
    'Snapshot-before-Checkpoint',
    'receipt per enforcement',
  ],
  doesNotInclude: [
    'autonomous capital decisions',
    'replacing founder judgment',
    'a separate public price SKU',
  ],
  sku: null,
  sourcePath: 'templates/rev-guardrail',
  sourceLabel: 'Source: templates/rev-guardrail/',
} as const;
