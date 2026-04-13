/**
 * Input-sanitization primitives for untrusted strings heading into a
 * control-sequence-sensitive sink (terminal, URL, HTML, shell, etc.).
 *
 * Scope: call these at the point a string crosses into a sink that parses
 * control bytes. Do not pre-sanitize at data ingress — sanitize for the
 * output context, where the threat model is concrete.
 */

// biome-ignore-all lint/suspicious/noControlCharactersInRegex: control bytes are the thing this module filters

// ─── Terminal / ANSI ─────────────────────────────────────────────────────
//
// Restricts the ANSI / control bytes that may be written into an xterm.js
// instance as *banner* text (welcome lines, status messages, anything not
// coming from a real PTY). The live PTY byte stream is trusted to xterm's
// own parser — this helper is for strings the app renders around it.
//
// Allow-list:
//  - Printable characters
//  - `\t`, `\n`, `\r`
//  - SGR (Select Graphic Rendition) CSI escapes — `\x1b[…m` — for colours
//    and text attributes only
//
// Stripped:
//  - OSC sequences (`\x1b]…`) — set window title, hyperlinks
//  - Non-SGR CSI sequences (`\x1b[…A|B|J|H|…`) — cursor moves, erase,
//    scroll region, mouse reporting
//  - DCS / PM / APC / SOS sequences
//  - Every C0 control byte except TAB / LF / CR
//  - DEL (0x7f)
//
// Single-pass alternation so each escape is matched exactly once —
// avoids a multi-pass pipeline stripping ESC bytes out of escapes that
// an earlier pass decided to keep (e.g. SGR). Order inside the alternation
// matters: longest / most-specific first.
//
//   \x1b]…(\x07|\x1b\\)?    — OSC
//   \x1b[PX^_]…(\x1b\\)?    — DCS / SOS / PM / APC
//   \x1b\[[0-?]*[ -/]*[@-~] — CSI (ECMA-48: params, intermediates, final)
//   \x1b.                   — bare 2-byte escape (Fs, Fp, nF)
//   \x1b                    — lone trailing ESC
const ANY_TERMINAL_ESCAPE =
  /\x1b\](?:[^\x07\x1b]*)(?:\x07|\x1b\\)?|\x1b[PX^_](?:[^\x1b]*)(?:\x1b\\)?|\x1b\[[0-?]*[ -/]*[@-~]|\x1b.|\x1b/g;

// An SGR CSI is `\x1b[` + params/intermediates + final byte `m`.
const SGR_CSI = /^\x1b\[[0-?]*[ -/]*m$/;

// C0 + DEL minus tab / lf / cr. ESC (0x1b) is excluded here because the
// first pass (ANY_TERMINAL_ESCAPE) has already decided whether to keep it
// (inside an SGR sequence) or drop it — stripping 0x1b here would shred
// preserved SGRs.
const DISALLOWED_TERMINAL_CONTROL = /[\x00-\x08\x0b\x0c\x0e-\x1a\x1c-\x1f\x7f]/g;

/**
 * Sanitize a string destined for a terminal banner / welcome sink.
 * Preserves SGR colour + attribute escapes, strips every other control
 * byte and ANSI sequence family.
 *
 * Why: untrusted ANSI is a known terminal-escape-injection surface
 * (cursor hijack, window-title rewrite, OSC-8 hyperlink spoofing). Use
 * this for any string the app writes to a terminal that did not come
 * directly from a trusted PTY.
 */
export function sanitizeTerminalLine(input: string): string {
  const stripped = input.replace(ANY_TERMINAL_ESCAPE, (match) =>
    SGR_CSI.test(match) ? match : '',
  );
  return stripped.replace(DISALLOWED_TERMINAL_CONTROL, '');
}
