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

// ─── Log redaction ───────────────────────────────────────────────────────
//
// Logs are the easiest way to leak secrets: a passing request payload gets
// dumped into a structured log, a header value lands in an error message,
// a stack trace carries an Authorization token. This helper is the single
// audited chokepoint between arbitrary structured data and the log sink.
//
// Two layers, applied in order:
//
//   1. Key-based: if the field name indicates a sensitive class (password,
//      token, apiKey, Authorization, cookie, session, cvv, ssn, …) the
//      value is replaced wholesale with `REDACTED`. Match is
//      case-insensitive substring so `userApiKey`, `X-API-KEY`, and
//      `apikey` all resolve to the same class.
//
//   2. Value-based: even when the key is benign, string values are scanned
//      for known secret shapes (JWT, Bearer header, Stripe / OpenAI / AWS /
//      GitHub keys) and each match is replaced with `REDACTED` inline.
//      This catches the `message: "got 401 for Bearer eyJ…"` footgun.
//
// Key-based redaction is strict-by-default (deny-list of substrings grown
// as new leak classes appear). Value-based scrubbing is pragmatic — the
// patterns are chosen to minimise false positives on opaque IDs.

export const REDACTED = '[REDACTED]' as const;

// Case-insensitive substring match on an alnum-normalised form of the key,
// so `apiKey` / `api_key` / `API-KEY` / `x-api-key` all resolve to the same
// substring class. Ordering does not matter — any hit triggers full-value
// redaction for that field.
const SENSITIVE_KEY_SUBSTRINGS: readonly string[] = [
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'apikey',
  'authorization',
  'cookie',
  'session',
  'privatekey',
  'encryptedkey',
  'creditcard',
  'cardnumber',
  'cvv',
  'cvc',
  'ssn',
];

const NON_ALNUM = /[^a-z0-9]/g;

// Inline secret shapes found in prose / error messages. Each is matched
// globally and replaced with REDACTED. Anchored with word boundaries or
// explicit prefixes to avoid clobbering opaque IDs of similar length.
const SECRET_VALUE_PATTERNS: readonly RegExp[] = [
  // JWT (header.payload.signature) — base64url segments, min lengths keep
  // this from matching arbitrary dotted identifiers.
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  // Bearer <token> in header-style strings.
  /\b[Bb]earer\s+[A-Za-z0-9._~+/-]{16,}=*/g,
  // OpenAI: sk-…, sk-proj-…, sk-svcacct-…
  /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}/g,
  // Stripe secret + restricted keys.
  /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{20,}/g,
  // Stripe webhook signing secret.
  /\bwhsec_[A-Za-z0-9]{20,}/g,
  // AWS access key id.
  /\bAKIA[0-9A-Z]{16}\b/g,
  // GitHub classic PAT (36+ char suffix) and fine-grained token.
  /\bghp_[A-Za-z0-9]{20,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/g,
];

/**
 * `true` if `key` names a class of value that must never reach a log.
 * Match is case-insensitive substring so variants like `userApiKey`,
 * `X-API-KEY`, `apikey`, `sessionId` all resolve to the same class.
 */
export function isSensitiveLogKey(key: string): boolean {
  const normalised = key.toLowerCase().replace(NON_ALNUM, '');
  for (const needle of SENSITIVE_KEY_SUBSTRINGS) {
    if (normalised.includes(needle)) return true;
  }
  return false;
}

/**
 * Scrub inline secret shapes (JWT, Bearer headers, provider API keys)
 * from an arbitrary string — for log messages, error messages, and
 * anything else that may have been concatenated from untrusted sources.
 * Returns the original string if nothing matched.
 */
export function redactSecretsInString(input: string): string {
  let out = input;
  for (const pattern of SECRET_VALUE_PATTERNS) {
    out = out.replace(pattern, REDACTED);
  }
  return out;
}

/**
 * Decide the safe form of a single log field.
 *
 * - If `key` is sensitive: returns `REDACTED` regardless of value shape.
 * - If `value` is a string: returns it with inline secret shapes scrubbed.
 * - Otherwise: returns `value` unchanged. Nested objects/arrays are the
 *   caller's responsibility — use `redactLogContext` to walk a tree.
 */
export function redactLogField(key: string, value: unknown): unknown {
  if (isSensitiveLogKey(key)) {
    return REDACTED;
  }
  if (typeof value === 'string') {
    return redactSecretsInString(value);
  }
  return value;
}

const MAX_REDACT_DEPTH = 8;

/**
 * Recursively redact a log context object. Walks plain objects and
 * arrays; leaves Dates, Errors, Maps, Sets, typed arrays, and other
 * non-plain objects untouched (stringifying them is the logger's job).
 *
 * Depth is capped at 8 to avoid pathological payloads — deeper levels
 * are replaced with `REDACTED` rather than recursed into.
 */
export function redactLogContext<T>(obj: T): T {
  return walk(obj, 0) as T;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function walk(value: unknown, depth: number): unknown {
  if (depth >= MAX_REDACT_DEPTH) {
    return isPlainObject(value) || Array.isArray(value) ? REDACTED : value;
  }
  if (typeof value === 'string') {
    return redactSecretsInString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => walk(item, depth + 1));
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (isSensitiveLogKey(k)) {
        out[k] = REDACTED;
      } else {
        out[k] = walk(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}
