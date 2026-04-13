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

// ─── Shell argument escaping ─────────────────────────────────────────────
//
// Command injection via unescaped interpolation (`exec(\`git log \${arg}\`)`)
// is the single most common sink-side bug in dev tooling. These helpers
// produce a *lexically* safe form of an argument so it crosses a shell
// boundary as a single token, with zero metacharacter interpretation.
//
// Preferred alternative: pass argv arrays to `spawn()` and skip the shell
// entirely. Use these only when a real shell is required (Windows .cmd,
// script composition, banner rendering).

// POSIX (sh / bash / zsh): single quotes disable *every* expansion except
// the single quote itself. Standard trick — close the quote, escape the
// quote, reopen. The result is always exactly one argv token.
function escapePosix(arg: string): string {
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

// Windows cmd.exe: double-quote the argument and double every embedded
// double quote. Also neutralise the metacharacters cmd.exe re-parses
// AFTER argv tokenisation (`&`, `|`, `<`, `>`, `^`, `(`, `)`, `%`, `!`)
// by prefixing with `^`. This is the "Everyone quotes command line
// arguments the wrong way" rule from the Microsoft devblog, plus the
// cmd.exe parser pass.
function escapeCmd(arg: string): string {
  const quoted = `"${arg.replace(/"/g, '""')}"`;
  return quoted.replace(/([&|<>^()%!])/g, '^$1');
}

// PowerShell: single quotes are literal (no interpolation); embedded
// single quotes are doubled. Safe in Core and Desktop editions.
function escapePowerShell(arg: string): string {
  return `'${arg.replace(/'/g, `''`)}'`;
}

export type ShellDialect = 'posix' | 'cmd' | 'powershell';

/**
 * Quote an untrusted string so it traverses a shell as a single literal
 * argv token, with no metacharacter interpretation.
 *
 * Use this only when a real shell is unavoidable. For local `spawn()`
 * calls, pass an argv array instead and skip shell parsing entirely.
 *
 * @param arg   - The untrusted value to embed.
 * @param shell - `'posix'` (default) for sh/bash/zsh, `'cmd'` for
 *                Windows cmd.exe, `'powershell'` for PowerShell.
 * @throws If `arg` contains a NUL byte (which every shell treats as an
 *         argument terminator — no safe encoding exists).
 */
export function escapeShellArg(arg: string, shell: ShellDialect = 'posix'): string {
  if (arg.includes('\0')) {
    throw new Error('escapeShellArg: NUL byte in argument — no shell can represent it');
  }
  switch (shell) {
    case 'posix':
      return escapePosix(arg);
    case 'cmd':
      return escapeCmd(arg);
    case 'powershell':
      return escapePowerShell(arg);
  }
}

// ─── URL scheme allow-list ───────────────────────────────────────────────
//
// Scheme confusion is the bug behind `javascript:`, `vbscript:`, and
// non-image `data:` injection into `href` / `src`. Every URL rendered
// from untrusted input must pass this filter.
//
// `link` context allows http(s), mailto, tel, anchor (#…), relative
// paths. `image` context additionally allows `data:image/…` for
// in-lined base64 images. Everything else returns `false`.

const SAFE_LINK_PROTOCOLS = /^(?:https?:|mailto:|tel:|#|\/)/i;
const SAFE_IMAGE_DATA_URI = /^data:image\//i;
const DANGEROUS_SCRIPT_PROTOCOL = /^(?:javascript|vbscript):/i;
const ANY_DATA_URI = /^data:/i;

export type UrlContext = 'link' | 'image';

/**
 * Return `true` if the URL is safe to render in the given context.
 *
 * - `link` (default): http(s), mailto:, tel:, fragment, relative path.
 * - `image`: same as link, plus `data:image/…` for inline base64 images.
 *
 * Blocks `javascript:` / `vbscript:` / non-image `data:`, including
 * leading-whitespace evasions (` javascript:…`) and mixed-case
 * (`JaVaScRiPt:…`). Unknown schemes are blocked by default — allow-list,
 * not deny-list.
 */
export function isSafeUrl(url: string, context: UrlContext = 'link'): boolean {
  const trimmed = url.trim();

  if (trimmed === '' || trimmed === '#') {
    return true;
  }
  if (context === 'image' && SAFE_IMAGE_DATA_URI.test(trimmed)) {
    return true;
  }
  if (ANY_DATA_URI.test(trimmed)) {
    return false;
  }
  if (DANGEROUS_SCRIPT_PROTOCOL.test(trimmed)) {
    return false;
  }
  if (SAFE_LINK_PROTOCOLS.test(trimmed) || !trimmed.includes(':')) {
    return true;
  }
  return false;
}

/**
 * Sanitize a URL for rendering. Returns the trimmed input if safe,
 * otherwise `'#'` — a harmless anchor that renders without navigation.
 */
export function sanitizeUrl(url: string, context: UrlContext = 'link'): string {
  return isSafeUrl(url, context) ? url.trim() : '#';
}
