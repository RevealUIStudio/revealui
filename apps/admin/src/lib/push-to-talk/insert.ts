/** Append a Whisper transcript into the same composer string typed text uses. */
export function insertTranscript(current: string, transcript: string): string {
  const next = transcript.trim();
  if (next.length === 0) return current;
  const prefix = current.trimEnd();
  if (prefix.length === 0) return next;
  return `${prefix} ${next}`;
}

/** Display name only — hosted .com never receives an OS path. */
export function fileDisplayName(name: string): string {
  const trimmed = name.trim();
  let start = 0;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === '/' || ch === '\\') start = i + 1;
  }
  const base = trimmed.slice(start);
  let out = '';
  for (const ch of base) {
    const code = ch.charCodeAt(0);
    if (code >= 32 && ch !== '[' && ch !== ']') out += ch;
  }
  return out.slice(0, 200);
}

/** Composer hint that a file lives on the laptop sidecar, not hosted disk. */
export function insertLocalFileRef(current: string, name: string): string {
  const display = fileDisplayName(name);
  if (display.length === 0) return current;
  return insertTranscript(current, `[local file: ${display}]`);
}
