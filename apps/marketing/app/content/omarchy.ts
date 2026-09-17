// Brand-approved Omarchy blurb. Runtime template / host plugin, not a SKU.
// FDE can wire this module onto other surfaces. /templates renders it as a
// labeled card so it is not mistaken for a CLI scaffold or a live paid SKU.
// Runtime skeleton source: templates/omarchy/ (test target only).
// Not indexed in claims-evidence. Not a fourth ladder SKU. Not required.

export interface OmarchyBlurb {
  readonly id: 'omarchy';
  readonly kind: 'template-plugin';
  readonly title: string;
  readonly eyebrow: string;
  readonly shortBlurb: string;
  readonly longer: string;
  readonly includes: readonly string[];
  readonly doesNotInclude: readonly string[];
  readonly sku: null;
  /** Repo-relative template source. Not a checkout SKU. */
  readonly sourcePath: 'templates/omarchy';
  readonly sourceLabel: string;
}

export const OMARCHY: OmarchyBlurb = {
  id: 'omarchy',
  kind: 'template-plugin',
  title: 'Omarchy',
  eyebrow: 'Runtime template · Host plugin',
  shortBlurb:
    'Runs great on Omarchy. Also Ubuntu, WSL, and macOS. A dogfood path for self-hosting the RevealUI business runtime.',
  longer:
    'Omarchy is a RevealUI runtime template for Omarchy Quattro users. Point inference at an OpenAI-compatible or Ollama URL, or at Ubuntu Inference Snaps already running on a host. This template does not reimplement snaps on Arch. It is a template, not a cash-ladder SKU and not required for Pilot or Launch.',
  includes: [
    'Docker and create-revealui install recipe',
    'OpenAI-compatible or Ollama URL wiring',
    'stream-safe tip for screen share',
    'tested target: Omarchy Quattro',
    'supported on Ubuntu, WSL, and macOS',
  ],
  doesNotInclude: [
    'Omarchy as a required host',
    'Ubuntu inference snaps reimplemented on Arch',
    'a fourth public price SKU',
  ],
  sku: null,
  sourcePath: 'templates/omarchy',
  sourceLabel: 'Source: templates/omarchy/',
} as const;
