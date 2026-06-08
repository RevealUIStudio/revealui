// No-regex glob matching for path excludes and `.leakignore` path-globs.
//
// Classic iterative wildcard matcher: `*` matches any run of characters
// (including `/`, matching the legacy bash `[[ path == glob ]]` semantics) and
// `?` matches exactly one character. No RegExp (M2 hardline).
export function matchGlob(text: string, pattern: string): boolean {
  let t = 0;
  let p = 0;
  let star = -1;
  let mark = 0;
  while (t < text.length) {
    if (p < pattern.length && (pattern[p] === '?' || pattern[p] === text[t])) {
      t += 1;
      p += 1;
    } else if (p < pattern.length && pattern[p] === '*') {
      star = p;
      mark = t;
      p += 1;
    } else if (star !== -1) {
      p = star + 1;
      mark += 1;
      t = mark;
    } else {
      return false;
    }
  }
  while (p < pattern.length && pattern[p] === '*') {
    p += 1;
  }
  return p === pattern.length;
}
