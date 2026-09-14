export type TranscribeFailureReason =
  | 'sidecar-unavailable'
  | 'forbidden-endpoint'
  | 'empty-audio'
  | 'invalid-response'
  | 'timeout'
  | 'too-large';

export type TranscribeResult =
  | { ok: true; text: string }
  | { ok: false; reason: TranscribeFailureReason; message: string };
