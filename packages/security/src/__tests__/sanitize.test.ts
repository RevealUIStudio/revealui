import { describe, expect, it } from 'vitest';
import { sanitizeTerminalLine } from '../sanitize.js';

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
});
