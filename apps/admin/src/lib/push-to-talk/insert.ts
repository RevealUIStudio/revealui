/** Append a Whisper transcript into the same composer string typed text uses. */
export function insertTranscript(current: string, transcript: string): string {
  const next = transcript.trim();
  if (next.length === 0) return current;
  const prefix = current.trimEnd();
  if (prefix.length === 0) return next;
  return `${prefix} ${next}`;
}
