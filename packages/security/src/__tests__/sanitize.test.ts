import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { escapeShellArg, isSafeUrl, sanitizeTerminalLine, sanitizeUrl } from '../sanitize.js';
import { ANSI_INJECTION_VECTORS } from './sanitize-corpus/ansi-injection.js';
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
