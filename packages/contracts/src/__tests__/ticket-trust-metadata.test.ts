/**
 * Spec 03: server-owned ticket trust metadata.
 * Client updates must not be able to set or clear trustPreset.
 */

import { describe, expect, it } from 'vitest';
import {
  mergeMetadataPreservingTrustPreset,
  parseTicketTrustPreset,
  TicketTrustMetadataSchema,
} from '../trust-preset.js';

describe('TicketTrustMetadataSchema', () => {
  it('accepts the low_trust_review key and other metadata', () => {
    const parsed = TicketTrustMetadataSchema.parse({
      trustPreset: 'low_trust_review',
      channel: 'public_form',
    });
    expect(parsed.trustPreset).toBe('low_trust_review');
    expect(parsed.channel).toBe('public_form');
  });

  it('rejects an unknown preset', () => {
    const parsed = TicketTrustMetadataSchema.safeParse({ trustPreset: 'custom' });
    expect(parsed.success).toBe(false);
  });
});

describe('parseTicketTrustPreset', () => {
  it('reads a server preset and fails closed on garbage', () => {
    expect(parseTicketTrustPreset({ trustPreset: 'standard', source: 'inbound_email' })).toEqual({
      ok: true,
      preset: 'standard',
    });
    expect(parseTicketTrustPreset(null)).toEqual({ ok: true, preset: null });
    expect(parseTicketTrustPreset({ source: 'public_form' })).toEqual({ ok: true, preset: null });
    expect(parseTicketTrustPreset({ trustPreset: 'off' })).toEqual({
      ok: false,
      reason: 'invalid_trust_preset',
    });
    expect(parseTicketTrustPreset(['low_trust_review'])).toEqual({
      ok: false,
      reason: 'invalid_trust_preset',
    });
  });
});

describe('mergeMetadataPreservingTrustPreset', () => {
  it('strips a client trustPreset and keeps the stored one', () => {
    const merged = mergeMetadataPreservingTrustPreset(
      { trustPreset: 'low_trust_review', channel: 'public_form' },
      { trustPreset: 'standard', channel: 'public_form', note: 'edited' },
    );
    expect(merged).toEqual({
      trustPreset: 'low_trust_review',
      channel: 'public_form',
      note: 'edited',
    });
  });

  it('does not let a client introduce trustPreset when none is stored', () => {
    const merged = mergeMetadataPreservingTrustPreset(
      { channel: 'inbound_email' },
      { trustPreset: 'standard', note: 'x' },
    );
    expect(merged).toEqual({ channel: 'inbound_email', note: 'x' });
    expect(Object.hasOwn(merged, 'trustPreset')).toBe(false);
  });

  it('keeps the stored preset when the client omits metadata keys', () => {
    const merged = mergeMetadataPreservingTrustPreset(
      { trustPreset: 'low_trust_review' },
      { trustPreset: null },
    );
    expect(merged.trustPreset).toBe('low_trust_review');
  });
});
