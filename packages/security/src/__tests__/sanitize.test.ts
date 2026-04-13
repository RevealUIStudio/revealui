import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  escapeShellArg,
  isSafeUrl,
  isSensitiveLogKey,
  REDACTED,
  redactLogContext,
  redactLogField,
  redactSecretsInString,
  sanitizeTerminalLine,
  sanitizeUrl,
} from '../sanitize.js';
import { ANSI_INJECTION_VECTORS } from './sanitize-corpus/ansi-injection.js';
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
    // Both replaced, not just one.
    expect(out.match(new RegExp(REDACTED.replace(/[[\]]/g, '\\$&'), 'g'))?.length).toBe(2);
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
