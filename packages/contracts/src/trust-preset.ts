/**
 * Server-owned ticket trust metadata (Spec 03).
 *
 * `trustPreset` is written by the server. Client and tool update paths must
 * merge through `mergeMetadataPreservingTrustPreset` so an agent cannot set
 * or clear the key.
 */

import { z } from 'zod/v4';

export const TRUST_PRESET_VALUES = ['standard', 'low_trust_review'] as const;
export const TrustPresetSchema = z.enum(TRUST_PRESET_VALUES);
export type TicketTrustPreset = (typeof TRUST_PRESET_VALUES)[number];

export const TRUST_PRESET_METADATA_KEY = 'trustPreset';

/** Ticket jsonb metadata. Unknown keys are preserved; `trustPreset` is enum-checked. */
export const TicketTrustMetadataSchema = z
  .object({
    trustPreset: TrustPresetSchema.optional(),
  })
  .passthrough();

export type TicketTrustMetadata = z.infer<typeof TicketTrustMetadataSchema>;

export type TicketTrustPresetParse =
  | { ok: true; preset: TicketTrustPreset | null }
  | { ok: false; reason: 'invalid_trust_preset' };

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Read `metadata.trustPreset`. Missing metadata or a missing key is no preset.
 * A present but invalid value fails closed.
 */
export function parseTicketTrustPreset(metadata: unknown): TicketTrustPresetParse {
  if (metadata == null) return { ok: true, preset: null };
  if (!isPlainRecord(metadata)) return { ok: false, reason: 'invalid_trust_preset' };
  if (!Object.hasOwn(metadata, TRUST_PRESET_METADATA_KEY)) return { ok: true, preset: null };
  const parsed = TrustPresetSchema.safeParse(metadata[TRUST_PRESET_METADATA_KEY]);
  if (!parsed.success) return { ok: false, reason: 'invalid_trust_preset' };
  return { ok: true, preset: parsed.data };
}

/**
 * Apply a client metadata patch without letting it write `trustPreset`.
 * A preset already stored on the record is copied back onto the merge.
 */
export function mergeMetadataPreservingTrustPreset(
  existing: unknown,
  incoming: unknown,
): Record<string, unknown> {
  const base = isPlainRecord(existing) ? { ...existing } : {};
  const patch = isPlainRecord(incoming) ? { ...incoming } : {};
  delete patch[TRUST_PRESET_METADATA_KEY];
  const merged: Record<string, unknown> = { ...base, ...patch };
  if (isPlainRecord(existing) && Object.hasOwn(existing, TRUST_PRESET_METADATA_KEY)) {
    merged[TRUST_PRESET_METADATA_KEY] = existing[TRUST_PRESET_METADATA_KEY];
  } else {
    delete merged[TRUST_PRESET_METADATA_KEY];
  }
  return merged;
}
