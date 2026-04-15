import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  escapeShellArg,
  escapeSqlIdentifier,
  isSafeUrl,
  isSensitiveLogKey,
  REDACTED,
  redactLogContext,
  redactLogField,
  redactSecretsInString,
  sanitizeHtml,
  sanitizeTerminalLine,
  sanitizeUrl,
} from '../sanitize.js';
import { ANSI_INJECTION_VECTORS } from './sanitize-corpus/ansi-injection.js';
import { DANGEROUS_HTML_VECTORS, SAFE_HTML_VECTORS } from './sanitize-corpus/html-injection.js';
import {
  SAFE_KEY_VECTORS,
  SECRET_VALUE_VECTORS,
  SENSITIVE_KEY_VECTORS,
} from './sanitize-corpus/log-redaction.js';
import {
  DANGEROUS_URL_VECTORS,
  SAFE_IMAGE_DATA_VECTORS,
  SAFE_URL_VECTORS,
} from './sanitize-corpus/scheme-confusion.js';
import { SHELL_INJECTION_VECTORS } from './sanitize-corpus/shell-injection.js';
import {
  DANGEROUS_IDENTIFIER_VECTORS,
  SAFE_IDENTIFIER_VECTORS,
} from './sanitize-corpus/sql-injection.js';

describe('sanitizeTerminalLine', () => {
  it('passes printable ASCII through unchanged', () => {
    expect(sanitizeTerminalLine('RevealUI Studio Terminal')).toBe('RevealUI Studio Terminal');
  });

  it('keeps \\t, \\n, \\r', () => {
    expect(sanitizeTerminalLine('col1\tcol2\r\nline2')).toBe('col1\tcol2\r\nline2');
  });

  it('keeps SGR CSI (colours + attributes)', () => {
    expect(sanitizeTerminalLine('\x1b[1;33mwarn\x1b[0m')).toBe('\x1b[1;33mwarn\x1b[0m');
    expect(sanitizeTerminalLine('\x1b[90mdim\x1b[0m')).toBe('\x1b[90mdim\x1b[0m');
  });

  it('strips cursor-movement CSI (non-m final byte)', () => {
    expect(sanitizeTerminalLine('before\x1b[2Aafter')).toBe('beforeafter');
    expect(sanitizeTerminalLine('home\x1b[H!')).toBe('home!');
    expect(sanitizeTerminalLine('erase\x1b[2J.')).toBe('erase.');
  });

  it('strips OSC title / hyperlink sequences', () => {
    expect(sanitizeTerminalLine('\x1b]0;pwned\x07hello')).toBe('hello');
    expect(sanitizeTerminalLine('\x1b]8;;https://evil.example\x07click\x1b]8;;\x07')).toBe('click');
  });

  it('strips DCS / PM / APC string sequences', () => {
    expect(sanitizeTerminalLine('\x1bP1;2|payload\x1b\\after')).toBe('after');
    expect(sanitizeTerminalLine('\x1b^note\x1b\\after')).toBe('after');
    expect(sanitizeTerminalLine('\x1b_app\x1b\\after')).toBe('after');
  });

  it('strips bare single-character ESC sequences', () => {
    expect(sanitizeTerminalLine('a\x1bcZ')).toBe('aZ');
  });

  it('strips disallowed C0 control bytes but keeps tab/newline/cr', () => {
    expect(sanitizeTerminalLine('ok\x00\x01bye')).toBe('okbye');
    expect(sanitizeTerminalLine('del\x7fwipe')).toBe('delwipe');
    expect(sanitizeTerminalLine('tab\there\nthere\r!')).toBe('tab\there\nthere\r!');
  });

  it('combines safely — SGR survives, hostile escapes do not', () => {
    const input = '\x1b]0;EVIL\x07\x1b[1;31mok\x1b[0m\x1b[2Jwipe';
    expect(sanitizeTerminalLine(input)).toBe('\x1b[1;31mok\x1b[0mwipe');
  });

  it.each(ANSI_INJECTION_VECTORS)('corpus: $rationale', ({ input, expected }) => {
    expect(sanitizeTerminalLine(input)).toBe(expected);
  });
});

describe('escapeShellArg (posix)', () => {
  it('wraps plain arguments in single quotes', () => {
    expect(escapeShellArg('hello')).toBe(`'hello'`);
  });

  it('wraps empty strings as a literal empty token', () => {
    expect(escapeShellArg('')).toBe(`''`);
  });

  it('escapes embedded single quotes using the close-escape-reopen trick', () => {
    expect(escapeShellArg(`it's`)).toBe(`'it'\\''s'`);
  });

  it('preserves newlines and tabs inside the quoted form', () => {
    expect(escapeShellArg('a\nb\tc')).toBe(`'a\nb\tc'`);
  });

  it('rejects NUL bytes (no shell encoding exists)', () => {
    expect(() => escapeShellArg('a\0b')).toThrow(/NUL/);
  });

  it.each(SHELL_INJECTION_VECTORS)('neutralises metacharacters: $rationale', ({ input }) => {
    const escaped = escapeShellArg(input);
    // bash receives exactly one argv token and echoes it back unchanged
    const echoed = execFileSync('bash', ['-c', `printf '%s' ${escaped}`], {
      encoding: 'utf8',
    });
    expect(echoed).toBe(input);
  });
});

describe('escapeShellArg (cmd)', () => {
  it('double-quotes the value and doubles embedded double quotes', () => {
    expect(escapeShellArg(`he said "hi"`, 'cmd')).toBe(`"he said ""hi"""`);
  });

  it('caret-escapes cmd.exe metacharacters after quoting', () => {
    expect(escapeShellArg('a&b|c', 'cmd')).toBe(`"a^&b^|c"`);
    expect(escapeShellArg('100%', 'cmd')).toBe(`"100^%"`);
    expect(escapeShellArg('!var!', 'cmd')).toBe(`"^!var^!"`);
  });
});

describe('escapeShellArg (powershell)', () => {
  it('single-quotes and doubles embedded single quotes', () => {
    expect(escapeShellArg(`it's`, 'powershell')).toBe(`'it''s'`);
  });

  it('leaves PowerShell-metacharacters literal inside single quotes', () => {
    expect(escapeShellArg('$env:PATH', 'powershell')).toBe(`'$env:PATH'`);
    expect(escapeShellArg('`n', 'powershell')).toBe(`'\`n'`);
  });
});

describe('isSafeUrl', () => {
  it('accepts empty string and bare anchor', () => {
    expect(isSafeUrl('')).toBe(true);
    expect(isSafeUrl('#')).toBe(true);
  });

  it.each(SAFE_URL_VECTORS)('allows: $rationale', ({ input }) => {
    expect(isSafeUrl(input)).toBe(true);
  });

  it.each(DANGEROUS_URL_VECTORS)('blocks: $rationale', ({ input }) => {
    expect(isSafeUrl(input)).toBe(false);
  });

  it('blocks data:image/ in link context but allows in image context', () => {
    for (const { input } of SAFE_IMAGE_DATA_VECTORS) {
      expect(isSafeUrl(input, 'link')).toBe(false);
      expect(isSafeUrl(input, 'image')).toBe(true);
    }
  });

  it('still blocks non-image data URIs in image context', () => {
    expect(isSafeUrl('data:text/html,<x>', 'image')).toBe(false);
  });
});

describe('sanitizeUrl', () => {
  it('returns the trimmed input when safe', () => {
    expect(sanitizeUrl('  https://example.com  ')).toBe('https://example.com');
  });

  it('returns "#" when unsafe', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('#');
    expect(sanitizeUrl(' javascript:alert(1)')).toBe('#');
  });
});

describe('isSensitiveLogKey', () => {
  it.each(SENSITIVE_KEY_VECTORS)('flags as sensitive: $key ($rationale)', ({ key }) => {
    expect(isSensitiveLogKey(key)).toBe(true);
  });

  it.each(SAFE_KEY_VECTORS)('leaves benign key unflagged: $key ($rationale)', ({ key }) => {
    expect(isSensitiveLogKey(key)).toBe(false);
  });

  it('matches case-insensitively', () => {
    expect(isSensitiveLogKey('API_KEY')).toBe(true);
    expect(isSensitiveLogKey('X-API-Key')).toBe(true);
    expect(isSensitiveLogKey('PASSWORD')).toBe(true);
  });

  it('matches as substring so composites like userApiKey redact', () => {
    expect(isSensitiveLogKey('userApiKey')).toBe(true);
    expect(isSensitiveLogKey('rawSessionId')).toBe(true);
    expect(isSensitiveLogKey('newPassword')).toBe(true);
  });
});

describe('redactSecretsInString', () => {
  it.each(SECRET_VALUE_VECTORS)('scrubs inline secret: $rationale', ({ input }) => {
    expect(redactSecretsInString(input)).toContain(REDACTED);
  });

  it('leaves strings without secret patterns unchanged', () => {
    expect(redactSecretsInString('user 123 updated profile')).toBe('user 123 updated profile');
    expect(redactSecretsInString('')).toBe('');
  });

  it('scrubs multiple secrets in one string', () => {
    const input = 'hit sk_live_51H7abcDEFghiJKLmnoPQRstuVWXyz0123 and AKIAIOSFODNN7EXAMPLE';
    const out = redactSecretsInString(input);
    expect(out).not.toContain('sk_live_');
    expect(out).not.toContain('AKIA');
    // Both replaced, not just one. Count by split to sidestep regex
    // entirely — no metacharacter handling, no partial-escape ambiguity.
    expect(out.split(REDACTED).length - 1).toBe(2);
  });

  it('does not over-match short opaque ids that look like Stripe/AWS keys', () => {
    // AWS key must be exactly AKIA + 16 uppercase alnum; shorter variants stay.
    expect(redactSecretsInString('AKIA123')).toBe('AKIA123');
    // sk- prefix requires 20+ chars after; short debug strings stay.
    expect(redactSecretsInString('sk-test')).toBe('sk-test');
  });
});

describe('redactLogField', () => {
  it('returns REDACTED for sensitive keys, regardless of value type', () => {
    expect(redactLogField('password', 'hunter2')).toBe(REDACTED);
    expect(redactLogField('apiKey', 12345)).toBe(REDACTED);
    expect(redactLogField('token', null)).toBe(REDACTED);
    expect(redactLogField('Authorization', { raw: 'x' })).toBe(REDACTED);
  });

  it('scrubs secret patterns inside benign-keyed string values', () => {
    const out = redactLogField(
      'message',
      'got Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc123def456ghi789',
    );
    expect(out).toContain(REDACTED);
    expect(out).not.toContain('eyJhbGc');
  });

  it('returns non-string benign values unchanged', () => {
    expect(redactLogField('userId', 42)).toBe(42);
    expect(redactLogField('ok', true)).toBe(true);
    expect(redactLogField('items', [1, 2, 3])).toEqual([1, 2, 3]);
  });
});

describe('redactLogContext', () => {
  it('redacts sensitive fields at the top level', () => {
    expect(redactLogContext({ userId: 'u1', password: 'p' })).toEqual({
      userId: 'u1',
      password: REDACTED,
    });
  });

  it('recurses into nested plain objects', () => {
    expect(
      redactLogContext({
        user: { id: 'u1', apiKey: 'sk-live-abc' },
        requestId: 'r1',
      }),
    ).toEqual({
      user: { id: 'u1', apiKey: REDACTED },
      requestId: 'r1',
    });
  });

  it('recurses into arrays of objects', () => {
    expect(
      redactLogContext({
        events: [
          { name: 'login', sessionId: 'abc' },
          { name: 'logout', sessionId: 'def' },
        ],
      }),
    ).toEqual({
      events: [
        { name: 'login', sessionId: REDACTED },
        { name: 'logout', sessionId: REDACTED },
      ],
    });
  });

  it('scrubs secret patterns inside benign-keyed strings during the walk', () => {
    const out = redactLogContext({
      message: 'pushed to ghp_abcdefghijklmnopqrstuvwxyz0123456789AB',
      userId: 'u1',
    }) as { message: string; userId: string };
    expect(out.message).toContain(REDACTED);
    expect(out.message).not.toContain('ghp_');
    expect(out.userId).toBe('u1');
  });

  it('leaves Errors, Dates, and Maps untouched — not plain objects', () => {
    const err = new Error('boom');
    const date = new Date('2025-01-01');
    const map = new Map([['k', 'v']]);
    const out = redactLogContext({ err, date, map }) as Record<string, unknown>;
    expect(out.err).toBe(err);
    expect(out.date).toBe(date);
    expect(out.map).toBe(map);
  });

  it('caps recursion depth and redacts beyond the cap', () => {
    // 10-level deep nested object exceeds the cap of 8.
    let nested: Record<string, unknown> = { leaf: 'value' };
    for (let i = 0; i < 10; i++) {
      nested = { next: nested };
    }
    // Should not throw, should not recurse forever.
    const out = redactLogContext(nested);
    expect(out).toBeDefined();
  });

  it('does not mutate the original input', () => {
    const input = { password: 'p', user: { apiKey: 'k' } };
    redactLogContext(input);
    expect(input.password).toBe('p');
    expect(input.user.apiKey).toBe('k');
  });

  it('returns primitives and non-plain values as-is at the top level', () => {
    expect(redactLogContext('plain string')).toBe('plain string');
    expect(redactLogContext(42)).toBe(42);
    expect(redactLogContext(null)).toBe(null);
    expect(redactLogContext(undefined)).toBe(undefined);
  });
});

describe('sanitizeHtml', () => {
  it('passes plain text through', () => {
    expect(sanitizeHtml('hello world')).toBe('hello world');
  });

  it('preserves the baseline allow-list', () => {
    const out = sanitizeHtml('<p>hi <strong>there</strong></p>');
    expect(out).toBe('<p>hi <strong>there</strong></p>');
  });

  it('drops <script> with its contents', () => {
    const out = sanitizeHtml('<p>before<script>alert(1)</script>after</p>');
    expect(out).not.toContain('script');
    expect(out).not.toContain('alert');
    expect(out).toContain('before');
    expect(out).toContain('after');
  });

  it('unwraps unknown tags, keeping their children', () => {
    const out = sanitizeHtml('<custom>kept <em>also kept</em></custom>');
    expect(out).not.toContain('<custom');
    expect(out).toContain('kept');
    expect(out).toContain('<em>also kept</em>');
  });

  it('strips on* event handlers regardless of tag', () => {
    const out = sanitizeHtml('<p onclick="alert(1)">x</p>');
    expect(out).not.toMatch(/onclick/i);
    expect(out).not.toContain('alert');
    expect(out).toContain('<p>x</p>');
  });

  it('strips style attribute categorically', () => {
    const out = sanitizeHtml('<p style="color:red">x</p>');
    expect(out).not.toContain('style=');
    expect(out).toContain('<p>x</p>');
  });

  it('filters href through isSafeUrl', () => {
    const bad = sanitizeHtml('<a href="javascript:alert(1)">x</a>');
    expect(bad).not.toContain('javascript:');
    expect(bad).not.toContain('alert');

    const good = sanitizeHtml('<a href="https://example.com">x</a>');
    expect(good).toContain('href="https://example.com"');
  });

  it('filters img src through isSafeUrl with image context', () => {
    const bad = sanitizeHtml('<img src="javascript:alert(1)">');
    expect(bad).not.toContain('javascript:');

    const ok = sanitizeHtml('<img src="data:image/png;base64,AAA" alt="x">');
    expect(ok).toContain('data:image/png');
  });

  it('auto-adds rel="noopener noreferrer" on target=_blank', () => {
    const out = sanitizeHtml('<a href="https://x.example" target="_blank">x</a>');
    expect(out).toContain('rel="');
    expect(out).toMatch(/rel="[^"]*noopener/);
    expect(out).toMatch(/rel="[^"]*noreferrer/);
  });

  it('preserves existing rel tokens and merges noopener/noreferrer', () => {
    const out = sanitizeHtml('<a href="https://x.example" target="_blank" rel="nofollow">x</a>');
    expect(out).toMatch(/rel="[^"]*nofollow/);
    expect(out).toMatch(/rel="[^"]*noopener/);
    expect(out).toMatch(/rel="[^"]*noreferrer/);
  });

  it('does not add rel when target is not _blank', () => {
    const out = sanitizeHtml('<a href="https://x.example">x</a>');
    expect(out).not.toContain('rel=');
  });

  it('allows aria-* and data-* attributes', () => {
    const out = sanitizeHtml('<p aria-label="lbl" data-test="1">x</p>');
    expect(out).toContain('aria-label="lbl"');
    expect(out).toContain('data-test="1"');
  });

  it('drops namespaced attributes', () => {
    const out = sanitizeHtml('<p xlink:href="https://x.example">x</p>');
    expect(out).not.toContain('xlink');
  });

  it('drops srcdoc attribute on any tag', () => {
    const out = sanitizeHtml('<img src="/x.png" srcdoc="<script>alert(1)</script>">');
    expect(out).not.toContain('srcdoc');
    expect(out).not.toContain('script');
  });

  it('drops HTML comments', () => {
    const out = sanitizeHtml('before<!-- <script>alert(1)</script> -->after');
    expect(out).not.toContain('<!--');
    expect(out).not.toContain('script');
    expect(out).toBe('beforeafter');
  });

  it('drops <svg> and contents', () => {
    const out = sanitizeHtml('<p>kept</p><svg onload=alert(1)><circle/></svg>');
    expect(out).not.toContain('svg');
    expect(out).not.toContain('circle');
    expect(out).not.toContain('onload');
    expect(out).toContain('kept');
  });

  it('drops <iframe> entirely', () => {
    const out = sanitizeHtml('ok<iframe src="https://evil.example">hidden</iframe>');
    expect(out).not.toContain('iframe');
    expect(out).not.toContain('hidden');
    expect(out).toContain('ok');
  });

  it('supports extraTags to widen the allow-list', () => {
    const out = sanitizeHtml('<figure>pic</figure>', { extraTags: ['figure'] });
    expect(out).toBe('<figure>pic</figure>');
  });

  it('supports extraAttrs to widen per-tag attrs', () => {
    const out = sanitizeHtml('<img src="/x.png" sizes="100vw">', {
      extraAttrs: { img: ['sizes'] },
    });
    expect(out).toContain('sizes="100vw"');
  });

  it.each(DANGEROUS_HTML_VECTORS)('corpus (dangerous): $rationale', ({ input, mustNotContain }) => {
    const out = sanitizeHtml(input);
    for (const needle of mustNotContain) {
      expect(out).not.toContain(needle);
    }
    // Blanket asserts — no event handler or script tag ever leaks.
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toMatch(/\son[a-z]+\s*=/i);
    expect(out).not.toMatch(/javascript:/i);
    expect(out).not.toMatch(/vbscript:/i);
  });

  it.each(SAFE_HTML_VECTORS)('corpus (safe): $rationale', ({ input, mustContain }) => {
    const out = sanitizeHtml(input);
    for (const needle of mustContain) {
      expect(out).toContain(needle);
    }
  });
});

describe('escapeSqlIdentifier', () => {
  it('wraps a simple identifier in double quotes', () => {
    expect(escapeSqlIdentifier('users')).toBe('"users"');
  });

  it('preserves case (quoted identifiers are case-sensitive in Postgres)', () => {
    expect(escapeSqlIdentifier('UserProfiles')).toBe('"UserProfiles"');
  });

  it('doubles embedded double-quotes', () => {
    expect(escapeSqlIdentifier('a"b')).toBe('"a""b"');
  });

  it('doubles every embedded double-quote', () => {
    expect(escapeSqlIdentifier('a"b"c')).toBe('"a""b""c"');
  });

  it('allows reserved words (the point of quoting)', () => {
    expect(escapeSqlIdentifier('select')).toBe('"select"');
    expect(escapeSqlIdentifier('from')).toBe('"from"');
  });

  it('allows non-ASCII identifiers', () => {
    expect(escapeSqlIdentifier('café')).toBe('"café"');
    expect(escapeSqlIdentifier('日本')).toBe('"日本"');
  });

  it('allows exactly 63 bytes', () => {
    const sixtyThree = 'a'.repeat(63);
    expect(escapeSqlIdentifier(sixtyThree)).toBe(`"${sixtyThree}"`);
  });

  it('allows single-quotes, semicolons, and comments inside the identifier', () => {
    // All inert when wrapped in double-quotes.
    expect(escapeSqlIdentifier("name';")).toBe(`"name';"`);
    expect(escapeSqlIdentifier('name--c')).toBe('"name--c"');
    expect(escapeSqlIdentifier('name/*c*/')).toBe('"name/*c*/"');
  });

  it('throws on empty string', () => {
    expect(() => escapeSqlIdentifier('')).toThrow(/must not be empty/);
  });

  it('throws on NUL byte', () => {
    expect(() => escapeSqlIdentifier('a\x00b')).toThrow(/NUL byte/);
    expect(() => escapeSqlIdentifier('\x00')).toThrow(/NUL byte/);
  });

  it('throws on identifiers longer than 63 bytes', () => {
    expect(() => escapeSqlIdentifier('a'.repeat(64))).toThrow(/63-byte limit/);
  });

  it('throws when UTF-8 byte length exceeds 63 even if character count does not', () => {
    // 22 × 3-byte UTF-8 = 66 bytes.
    expect(() => escapeSqlIdentifier('日'.repeat(22))).toThrow(/63-byte limit/);
  });

  it('allows 63-byte UTF-8 identifier (21 × 3-byte chars)', () => {
    const input = '日'.repeat(21);
    expect(escapeSqlIdentifier(input)).toBe(`"${input}"`);
  });

  it.each(DANGEROUS_IDENTIFIER_VECTORS)('corpus: $rationale', ({ input, mode }) => {
    if (mode === 'throws') {
      expect(() => escapeSqlIdentifier(input)).toThrow();
      return;
    }
    const out = escapeSqlIdentifier(input);
    expect(out.startsWith('"')).toBe(true);
    expect(out.endsWith('"')).toBe(true);
    // Every embedded `"` must appear as `""` in the output — the body
    // between the outer quotes must contain no lone quotes.
    const body = out.slice(1, -1);
    const lone = body.replace(/""/g, '');
    expect(lone).not.toContain('"');
  });

  it.each(SAFE_IDENTIFIER_VECTORS)('safe corpus: %s', (input) => {
    const out = escapeSqlIdentifier(input);
    expect(out).toBe(`"${input.split('"').join('""')}"`);
  });
});
