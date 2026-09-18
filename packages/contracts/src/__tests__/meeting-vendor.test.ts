import { describe, expect, it } from 'vitest';
import {
  BANNED_MEETING_VENDOR_IDS,
  CONSULTATION_MEETING_CAPTURE_KIND,
  consultationSessionBuyerCopy,
  DEFAULT_MEETING_VENDOR_ID,
  emptyMeetingSessionRef,
  isSupportedMeetingVendorId,
  NARRATED_WALK_CAPTURE_KIND,
  toMeetingBundleFields,
  WHISPER_ASSESS_PIPELINE,
} from '../meeting-vendor.js';

describe('meeting-vendor adapter', () => {
  it('defaults Consultation capture to Meet-first vendor-record, not OBS', () => {
    const session = emptyMeetingSessionRef();
    expect(session.vendorId).toBe(DEFAULT_MEETING_VENDOR_ID);
    expect(DEFAULT_MEETING_VENDOR_ID).toBe('google-meet');
    expect(session.captureKind).toBe(CONSULTATION_MEETING_CAPTURE_KIND);
    expect(CONSULTATION_MEETING_CAPTURE_KIND).toBe('vendor-record');
    expect(NARRATED_WALK_CAPTURE_KIND).toBe('narrated-walk');
  });

  it('exposes provider-agnostic P2 bundle fields', () => {
    const session = emptyMeetingSessionRef();
    session.meetLink = 'https://meet.example/join';
    session.recordingUri = 'https://drive.example/file/abc';
    expect(toMeetingBundleFields(session)).toEqual({
      meet_link: 'https://meet.example/join',
      recording_uri: 'https://drive.example/file/abc',
    });
  });

  it('lets Zoom slot in later without changing the wire fields', () => {
    const zoom = emptyMeetingSessionRef('zoom');
    expect(isSupportedMeetingVendorId('zoom')).toBe(true);
    expect(toMeetingBundleFields(zoom)).toEqual({
      meet_link: null,
      recording_uri: null,
    });
  });

  it('keeps Whisper assess as the post-record pipeline', () => {
    expect(WHISPER_ASSESS_PIPELINE).toEqual({
      transcribe: 'whisper-small',
      assess: 'llm-vs-prep',
    });
  });

  it('rejects Cal.com, HubSpot, and autodialer as vendors', () => {
    expect(BANNED_MEETING_VENDOR_IDS).toEqual(['cal-com', 'hubspot', 'autodialer']);
    expect(isSupportedMeetingVendorId('cal-com')).toBe(false);
    expect(isSupportedMeetingVendorId('hubspot')).toBe(false);
    expect(isSupportedMeetingVendorId('autodialer')).toBe(false);
  });

  it('buyer session copy is vendor-agnostic', () => {
    const copy = consultationSessionBuyerCopy();
    expect(copy).toContain('video session');
    expect(copy).toContain('consent');
    expect(copy.includes('Google Meet')).toBe(false);
    expect(copy.includes('Cal.com')).toBe(false);
    expect(copy.includes('Zoom')).toBe(false);
    expect(copy.includes('OBS')).toBe(false);
  });
});
