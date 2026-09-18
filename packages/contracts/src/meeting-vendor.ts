/**
 * Pluggable meeting-vendor adapter.
 *
 * Near-term Consultation capture is Meet-first: consent → vendor record →
 * Whisper → assess. OBS stays on `narrated-walk` only. Wire fields stay
 * provider-agnostic (`meet_link` + `recording_uri`) so Zoom can slot later
 * without ripping Desk/Calendar. P2 bundle hooks consume those fields.
 *
 * Banned: Cal.com, HubSpot, autodialer.
 *
 * @packageDocumentation
 */

export const DEFAULT_MEETING_VENDOR_ID = 'google-meet' as const;

export const SUPPORTED_MEETING_VENDOR_IDS = ['google-meet', 'zoom'] as const;

export type MeetingVendorId = (typeof SUPPORTED_MEETING_VENDOR_IDS)[number];

export const BANNED_MEETING_VENDOR_IDS = ['cal-com', 'hubspot', 'autodialer'] as const;

export type BannedMeetingVendorId = (typeof BANNED_MEETING_VENDOR_IDS)[number];

/** Default Consultation capture. Vendor records the call after consent. */
export const CONSULTATION_MEETING_CAPTURE_KIND = 'vendor-record' as const;

/** Narrated screen walks only. Not the Consultation meeting default. */
export const NARRATED_WALK_CAPTURE_KIND = 'narrated-walk' as const;

export type MeetingCaptureKind =
  | typeof CONSULTATION_MEETING_CAPTURE_KIND
  | typeof NARRATED_WALK_CAPTURE_KIND;

export const WHISPER_ASSESS_PIPELINE = {
  transcribe: 'whisper-small',
  assess: 'llm-vs-prep',
} as const;

export type WhisperAssessPipeline = typeof WHISPER_ASSESS_PIPELINE;

export interface MeetingSessionRef {
  vendorId: MeetingVendorId;
  captureKind: MeetingCaptureKind;
  meetLink: string | null;
  recordingUri: string | null;
  recordingConsent: boolean;
}

/** Provider-agnostic P2 bundle wire fields. */
export interface MeetingBundleFields {
  meet_link: string | null;
  recording_uri: string | null;
}

export function isSupportedMeetingVendorId(value: unknown): value is MeetingVendorId {
  return value === 'google-meet' || value === 'zoom';
}

export function emptyMeetingSessionRef(
  vendorId: MeetingVendorId = DEFAULT_MEETING_VENDOR_ID,
): MeetingSessionRef {
  const resolved = isSupportedMeetingVendorId(vendorId) ? vendorId : DEFAULT_MEETING_VENDOR_ID;
  return {
    vendorId: resolved,
    captureKind: CONSULTATION_MEETING_CAPTURE_KIND,
    meetLink: null,
    recordingUri: null,
    recordingConsent: false,
  };
}

export function toMeetingBundleFields(session: MeetingSessionRef): MeetingBundleFields {
  return {
    meet_link: session.meetLink,
    recording_uri: session.recordingUri,
  };
}

const CONSULTATION_SESSION_BUYER_COPY =
  'One video session with screen share. Recording happens only after you consent.';

export function consultationSessionBuyerCopy(): string {
  return CONSULTATION_SESSION_BUYER_COPY;
}
