/**
 * DevKit Profiles — Max-tier `devkitProfiles` paywall.
 *
 * Single source of truth for the per-user DevKit profile selection.
 *
 * The list leans **RevealUI native** as the recommended default, with
 * external editors retained as secondary options for users with
 * established Claude / Cursor / Zed workflows.
 *
 * A "profile" is a bundle of editor / agent configuration that lives in
 * the sibling `revcon` repo at `~/suite/revcon/profiles/revealui/<id>/`
 * (with the exception of `revealui`, whose config IS the native runtime
 * itself — no external bundle needed). The RevealUI runtime doesn't
 * ship the profile content; it just stores the user's choice and
 * exposes the metadata for downstream consumers (CLI, admin UI) to
 * fetch and apply.
 *
 * The DB CHECK constraint on `users.devkit_profile` enumerates the
 * same five IDs — keep them in sync if the list changes.
 */

export const DEVKIT_PROFILES = ['revealui', 'agents', 'claude', 'cursor', 'zed'] as const;
export type DevkitProfileId = (typeof DEVKIT_PROFILES)[number];

export type DevkitProfileKind = 'native' | 'agent-skills' | 'external-editor';

export interface DevkitProfileMeta {
  id: DevkitProfileId;
  label: string;
  description: string;
  kind: DevkitProfileKind;
  /** True for the recommended default profile. */
  recommended?: boolean;
}

export const DEVKIT_PROFILE_METADATA: readonly DevkitProfileMeta[] = [
  {
    id: 'revealui',
    label: 'RevealUI Native',
    description:
      'The first-party RevealUI editor + agent runtime. Bundled admin UI, native MCP wiring, and zero external editor configuration. Recommended for new users and the canonical path going forward.',
    kind: 'native',
    recommended: true,
  },
  {
    id: 'agents',
    label: 'Agent Skills Bundle',
    description:
      'RevealUI-authored Claude Code skills (next-best-practices, revealui-conventions, revealui-tdd, etc.) installable into any agent runtime that supports the Claude Code skills format.',
    kind: 'agent-skills',
  },
  {
    id: 'claude',
    label: 'Claude Code (external)',
    description:
      'External-editor profile for Anthropic Claude Code. Use this if you prefer Claude Code as your primary IDE; the RevealUI native runtime stays secondary.',
    kind: 'external-editor',
  },
  {
    id: 'cursor',
    label: 'Cursor (external)',
    description:
      'External-editor profile for Cursor IDE — MCP server registration, Composer rules, project-level config. Use this if you prefer Cursor as your primary IDE.',
    kind: 'external-editor',
  },
  {
    id: 'zed',
    label: 'Zed (external)',
    description:
      'External-editor profile for Zed — task definitions and MCP wiring for the Zed agent panel. Use this if you prefer Zed as your primary IDE.',
    kind: 'external-editor',
  },
] as const;

export function isDevkitProfileId(value: unknown): value is DevkitProfileId {
  return typeof value === 'string' && (DEVKIT_PROFILES as readonly string[]).includes(value);
}
