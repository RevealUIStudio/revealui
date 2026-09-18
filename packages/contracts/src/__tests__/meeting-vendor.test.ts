import { describe, expect, it } from 'vitest';
import {
  BANNED_MEETING_VENDOR_IDS,
  CONSULTATION_MEETING_CAPTURE_KIND,
  consultationSessionBuyerCopy,
  DEFAULT_MEETING_VENDOR_ID,
  emptyMeetingSessionRef,
  isNakedJoinUrl,
  isSupportedMeetingVendorId,
  MEETING_ASSESS_KG_NODE_KINDS,
  MEETING_AUTOMATION_STEPS,
  MEETING_HUMAN_STEP,
  NARRATED_WALK_CAPTURE_KIND,
  NARRATED_WALK_PURPOSES,
  toMeetingAssessKgDelivery,
  toMeetingBundleFields,
  toMeetingDeliveryCard,
  toMeetingScheduleIntent,
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

  it('defaults to guest-first join, not an account-required vendor UX', () => {
    const session = emptyMeetingSessionRef();
    expect(session.guestJoin).toBe(true);
    expect(session.joinRequiresAccount).toBe(false);
    const copy = consultationSessionBuyerCopy();
    expect(copy.toLowerCase().includes('no account required')).toBe(true);
    expect(copy.includes('Google account')).toBe(false);
  });

  it('delivers a naked join URL as a bird-eye link, not a filesystem path', () => {
    const session = emptyMeetingSessionRef();
    session.meetLink = 'https://meet.example/join';
    expect(isNakedJoinUrl(session.meetLink)).toBe(true);
    expect(isNakedJoinUrl('/tmp/meet.txt')).toBe(false);
    expect(isNakedJoinUrl('file:///tmp/meet')).toBe(false);
    expect(toMeetingDeliveryCard(session)).toEqual({
      kind: 'link',
      href: 'https://meet.example/join',
      label: 'Join session',
    });
    session.meetLink = '/var/recordings/session.mp4';
    expect(toMeetingDeliveryCard(session)).toBeNull();
  });

  it('automates schedule, prep, consent, and reminders; opening the link stays human', () => {
    expect(MEETING_AUTOMATION_STEPS).toEqual([
      'create_event',
      'attach_join_url',
      'send_prep',
      'record_consent',
      'send_reminders',
    ]);
    expect(MEETING_HUMAN_STEP).toBe('open_join_link');
    const session = emptyMeetingSessionRef();
    session.meetLink = 'https://meet.example/join';
    expect(toMeetingScheduleIntent(session)).toEqual({
      action: 'create_event',
      meetLink: 'https://meet.example/join',
      putNakedUrlInDescription: true,
      guestJoin: true,
      reminders: ['prep', 'consent', 'start'],
    });
  });

  it('maps post-meet assess to KG node kinds without a P0 bundle snapshot', () => {
    expect(MEETING_ASSESS_KG_NODE_KINDS).toEqual(['problem', 'stack', 'next-sku']);
    expect(toMeetingAssessKgDelivery()).toEqual({
      kind: 'link',
      href: '/knowledge-graph',
      label: 'Knowledge Graph',
    });
    const session = emptyMeetingSessionRef();
    session.recordingUri = 'https://drive.example/file/abc';
    expect(toMeetingBundleFields(session)).toEqual({
      meet_link: null,
      recording_uri: 'https://drive.example/file/abc',
    });
    expect(Object.keys(toMeetingBundleFields(session)).includes('kg_snapshot')).toBe(false);
  });

  it('scopes narrated-walk to walks and livestream, not Consultation capture', () => {
    expect(NARRATED_WALK_PURPOSES).toEqual(['walkthrough', 'livestream', 'youtube-when-needed']);
    expect(NARRATED_WALK_PURPOSES.includes('consultation')).toBe(false);
    expect(CONSULTATION_MEETING_CAPTURE_KIND).not.toBe(NARRATED_WALK_CAPTURE_KIND);
  });
});
