# No Regex Policy

## Rule

Avoid regular expressions in all new and modified code. When fixing existing code that uses regex, replace with a non-regex alternative.

## Preferred Alternatives

| Instead of | Use |
|---|---|
| `/^prefix/.test(s)` | `s.startsWith('prefix')` |
| `/suffix$/.test(s)` | `s.endsWith('suffix')` |
| `/needle/.test(s)` | `s.includes('needle')` |
| Email validation regex | `z.string().email()` (Zod) |
| URL validation regex | `new URL(input)` in try/catch |
| Hostname validation regex | `new URL('https://' + host).hostname === host` |
| Complex string splitting | `.split()` with delimiter |
| Character class checks | `.charCodeAt()` or explicit checks |
| Path pattern matching | `minimatch` or `picomatch` (glob) |
| HTML/JSON extraction | Proper parser |

## Acceptable Exceptions

Regex is permitted only when no reasonable alternative exists:
- Biome/linter configuration (requires regex syntax)
- Git hook pattern matching (grep/sed in shell scripts)
- Third-party API requirements (e.g., OpenAPI pattern fields)
- Performance-critical hot paths where regex is measurably faster

When an exception is necessary, add a comment: `// regex-ok: <reason>`

## Enforcement

- CodeQL catches dangerous regex patterns (ReDoS, missing anchors)
- Code review should flag new regex usage and suggest alternatives
- Existing regex should be replaced opportunistically when touching a file
