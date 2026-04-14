export interface AnsiVector {
  input: string;
  expected: string;
  rationale: string;
}

export const ANSI_INJECTION_VECTORS: readonly AnsiVector[] = [
  {
    input: '\x1b]0;pwned\x07hello',
    expected: 'hello',
    rationale: 'OSC 0 — rewrite terminal window title',
  },
  {
    input: '\x1b]8;;https://evil.example\x07click\x1b]8;;\x07',
    expected: 'click',
    rationale: 'OSC 8 hyperlink — spoof the visible URL',
  },
  {
    input: 'before\x1b[2Aafter',
    expected: 'beforeafter',
    rationale: 'CSI cursor-up — overwrite earlier output',
  },
  {
    input: 'home\x1b[H!',
    expected: 'home!',
    rationale: 'CSI cursor-home — reposition subsequent writes',
  },
  {
    input: 'erase\x1b[2J.',
    expected: 'erase.',
    rationale: 'CSI erase-display — blank the buffer',
  },
  {
    input: '\x1bP1;2|payload\x1b\\after',
    expected: 'after',
    rationale: 'DCS string — pass-through payload to terminal decoder',
  },
  {
    input: 'ok\x00\x01bye',
    expected: 'okbye',
    rationale: 'C0 control bytes that xterm may interpret',
  },
  {
    input: '\x1b[1;33mwarn\x1b[0m',
    expected: '\x1b[1;33mwarn\x1b[0m',
    rationale: 'SGR colour — must be preserved (allow-list target)',
  },
] as const;
