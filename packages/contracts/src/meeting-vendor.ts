/**
 * Pluggable meeting-vendor adapter.
 *
 * Near-term Consultation capture is Meet-first and guest-first: consent →
 * vendor record → Whisper → assess. Automate schedule/prep/consent/reminders;
 * the human only opens the join link. Join-as-guest is the default UX — do
 * not require a Google (or other vendor) account when guest join works.
 *
 * OBS / narrated-walk stays on walkthroughs, livestream, and
 * YouTube-when-needed. It is not the Consultation meeting default.
 *
 * Wire fields stay provider-agnostic (`meet_link` + `recording_uri`) so Zoom
 * can slot later without ripping Desk/Calendar. Delivery is a bird-eye link
 * card, never a filesystem path. P2 bundle hooks consume the wire fields.
 *
 * This module does not call Calendar MCP. `toMeetingScheduleIntent` is the
 * later create_event payload shape.
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

/** OBS / YouTube Studio stay on these purposes. Never Consultation capture. */
export const NARRATED_WALK_PURPOSES = ['walkthrough', 'livestream', 'youtube-when-needed'] as const;

export type NarratedWalkPurpose = (typeof NARRATED_WALK_PURPOSES)[number];

/** Programmatic steps. Calendar MCP later consumes `create_event`. */
export const MEETING_AUTOMATION_STEPS = [
  'create_event',
  'attach_join_url',
  'send_prep',
  'record_consent',
  'send_reminders',
] as const;

export type MeetingAutomationStep = (typeof MEETING_AUTOMATION_STEPS)[number];

/** The only step a human must do. */
export const MEETING_HUMAN_STEP = 'open_join_link' as const;

export type MeetingHumanStep = typeof MEETING_HUMAN_STEP;

export const MEETING_REMINDER_KINDS = ['prep', 'consent', 'start'] as const;

export type MeetingReminderKind = (typeof MEETING_REMINDER_KINDS)[number];

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
  /** Join-as-guest is the default. Do not require a vendor account. */
  guestJoin: boolean;
  joinRequiresAccount: boolean;
}

/** Bird-eye delivery in chat/UI. Never a filesystem path. */
export interface MeetingDeliveryCard {
  kind: 'link';
  href: string;
  label: string;
}

/** Later Calendar MCP `create_event` shape. Not invoked here. */
export interface MeetingScheduleIntent {
  action: 'create_event';
  meetLink: string | null;
  putNakedUrlInDescription: true;
  guestJoin: true;
  reminders: readonly MeetingReminderKind[];
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
    guestJoin: true,
    joinRequiresAccount: false,
  };
}

export function isNakedJoinUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) {
    return false;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function toMeetingDeliveryCard(session: MeetingSessionRef): MeetingDeliveryCard | null {
  if (!isNakedJoinUrl(session.meetLink)) {
    return null;
  }
  return {
    kind: 'link',
    href: session.meetLink,
    label: 'Join session',
  };
}

export function toMeetingScheduleIntent(session: MeetingSessionRef): MeetingScheduleIntent {
  return {
    action: 'create_event',
    meetLink: isNakedJoinUrl(session.meetLink) ? session.meetLink : null,
    putNakedUrlInDescription: true,
    guestJoin: true,
    reminders: MEETING_REMINDER_KINDS,
  };
}

export function toMeetingBundleFields(session: MeetingSessionRef): MeetingBundleFields {
  return {
    meet_link: session.meetLink,
    recording_uri: session.recordingUri,
  };
}

const CONSULTATION_SESSION_BUYER_COPY =
  'One video session with screen share. Join from the link. No account required. Recording happens only after you consent.';

export function consultationSessionBuyerCopy(): string {
  return CONSULTATION_SESSION_BUYER_COPY;
}
