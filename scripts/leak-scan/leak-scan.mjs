// scripts/leak-scan/cli.ts
import { existsSync as existsSync2, readFileSync as readFileSync3 } from "node:fs";
import { join as join2 } from "node:path";

// scripts/leak-scan/config.ts
import { existsSync, readFileSync } from "node:fs";

// scripts/leak-scan/predicates.ts
var isLower = (c) => c >= "a" && c <= "z";
var isUpper = (c) => c >= "A" && c <= "Z";
var isDigit = (c) => c >= "0" && c <= "9";
var isHexLower = (c) => isDigit(c) || c >= "a" && c <= "f";
var isAlnum = (c) => isLower(c) || isUpper(c) || isDigit(c);
var isLowerNameChar = (c) => isLower(c) || isDigit(c) || c === "_" || c === "-";
var isNameChar = (c) => isAlnum(c) || c === "_" || c === "-";
var isPathSep = (c) => c === "\\" || c === "/";
var lit = (value) => ({ kind: "literal", value });
var run = (cls, min, max) => ({
  kind: "class",
  cls,
  min,
  max
});
function matchAt(s, start, segments) {
  let i = start;
  for (const seg of segments) {
    if (seg.kind === "literal") {
      if (!s.startsWith(seg.value, i)) return -1;
      i += seg.value.length;
    } else {
      const cap = seg.max ?? Number.POSITIVE_INFINITY;
      let count = 0;
      while (i < s.length && count < cap && seg.cls(s[i])) {
        i += 1;
        count += 1;
      }
      if (count < seg.min) return -1;
    }
  }
  return i;
}
function containsPattern(s, segments) {
  for (let i = 0; i < s.length; i += 1) {
    if (matchAt(s, i, segments) !== -1) return true;
  }
  return false;
}
function literalIncludes(s, value) {
  return s.includes(value);
}

// scripts/leak-scan/config.ts
var ConfigError = class extends Error {
};
function loadLocalRules(path) {
  if (!existsSync(path)) return [];
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    throw new ConfigError(`leak-scan: invalid JSON in ${path}: ${err.message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new ConfigError(`leak-scan: ${path} must be a JSON array of rules`);
  }
  return parsed.map((raw, index) => toRule(raw, index, path));
}
function toRule(raw, index, path) {
  const where = `${path}[${index}]`;
  if (typeof raw.tag !== "string" || raw.tag === "") {
    throw new ConfigError(`${where}: "tag" must be a non-empty string`);
  }
  if (typeof raw.reason !== "string" || raw.reason === "") {
    throw new ConfigError(`${where}: "reason" must be a non-empty string`);
  }
  const hasLiteral = typeof raw.literal === "string";
  const hasAnyOf = Array.isArray(raw.anyOf);
  if (hasLiteral === hasAnyOf) {
    throw new ConfigError(
      `${where}: provide exactly one of "literal" (string) or "anyOf" (string[])`
    );
  }
  const { tag, reason } = raw;
  if (hasLiteral) {
    const value = raw.literal;
    if (value === "") throw new ConfigError(`${where}: "literal" must be non-empty`);
    return { tag, reason, matches: (line) => literalIncludes(line, value) };
  }
  const values = raw.anyOf.map((v, j) => {
    if (typeof v !== "string" || v === "") {
      throw new ConfigError(`${where}.anyOf[${j}]: each entry must be a non-empty string`);
    }
    return v;
  });
  if (values.length === 0) throw new ConfigError(`${where}: "anyOf" must list at least one string`);
  return { tag, reason, matches: (line) => values.some((v) => literalIncludes(line, v)) };
}

// scripts/leak-scan/glob.ts
function matchGlob(text, pattern) {
  let t = 0;
  let p = 0;
  let star = -1;
  let mark = 0;
  while (t < text.length) {
    if (p < pattern.length && (pattern[p] === "?" || pattern[p] === text[t])) {
      t += 1;
      p += 1;
    } else if (p < pattern.length && pattern[p] === "*") {
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
  while (p < pattern.length && pattern[p] === "*") {
    p += 1;
  }
  return p === pattern.length;
}

// scripts/leak-scan/leakignore.ts
function parseLeakignore(text) {
  const entries = [];
  for (const raw of text.split("\n")) {
    const hash = raw.indexOf("#");
    const line = (hash === -1 ? raw : raw.slice(0, hash)).trim();
    if (line === "") continue;
    const ws = firstWhitespace(line);
    if (ws === -1) continue;
    const glob = line.slice(0, ws);
    const tagSpec = line.slice(ws).trim();
    if (tagSpec === "") continue;
    const tags = new Set(
      tagSpec.split(",").map((tag) => tag.trim()).filter((tag) => tag !== "")
    );
    if (tags.size === 0) continue;
    entries.push({ glob, tags });
  }
  return entries;
}
function firstWhitespace(s) {
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (c === " " || c === "	") return i;
  }
  return -1;
}
function makeIsIgnored(entries) {
  return (relPath, tag) => {
    const rel = relPath.startsWith("./") ? relPath.slice(2) : relPath;
    for (const entry of entries) {
      if (entry.tags.has(tag) && matchGlob(rel, entry.glob)) return true;
    }
    return false;
  };
}

// scripts/leak-scan/report.ts
function formatText(findings) {
  const out = [];
  for (const f of findings) {
    out.push(`[LEAK:${f.tag}] ${f.file}:${f.line} - ${f.reason}`);
    out.push(`  -> ${f.content}`);
  }
  return out.join("\n");
}
function formatJson(findings) {
  return JSON.stringify({ violations: findings.length, entries: findings });
}

// scripts/leak-scan/rules.ts
var literalRule = (tag, value, reason) => ({
  tag,
  reason,
  matches: (line) => literalIncludes(line, value)
});
var patternRule = (tag, segments, reason) => ({
  tag,
  reason,
  matches: (line) => containsPattern(line, segments)
});
var isCDrive = (c) => c === "c" || c === "C";
var BASE_RULES = [
  patternRule(
    "abs-home-path",
    [lit("/home/"), run(isLower, 1, 1), run(isLowerNameChar, 1)],
    "absolute user home path (/home/<username>/...)"
  ),
  patternRule(
    "abs-windows-user",
    [
      run(isCDrive, 1, 1),
      lit(":"),
      run(isPathSep, 1, 1),
      lit("Users"),
      run(isPathSep, 1, 1),
      run(isNameChar, 1)
    ],
    "absolute Windows user path (C:\\Users\\<name>)"
  ),
  literalRule("private-jv-repo", "revfleet/.jv", "private repo path (~/revfleet/.jv/...)"),
  literalRule("private-jv-name", "revealui-jv", "private repo name (revealui-jv)"),
  literalRule("lts-drive", "/mnt/e/", "LTS drive mount path"),
  literalRule("forge-drive", "/mnt/forge/", "Forge drive mount path"),
  literalRule("sandbox-drive", "/mnt/sandbox/", "Sandbox drive mount path"),
  patternRule(
    "license-key",
    [lit("RVUI-"), run(isLower, 1), lit("-"), run(isHexLower, 16)],
    "RevealUI license key (looks like a real issued key)"
  ),
  patternRule("vercel-org-id", [lit("team_"), run(isAlnum, 16)], "Vercel org/team identifier"),
  patternRule("vercel-project-id", [lit("prj_"), run(isAlnum, 16)], "Vercel project identifier"),
  patternRule("stripe-account", [lit("acct_"), run(isAlnum, 14)], "Stripe account identifier"),
  patternRule("stripe-product", [lit("prod_"), run(isAlnum, 14)], "Stripe product identifier"),
  patternRule(
    "stripe-portal-config",
    [lit("bpc_"), run(isAlnum, 14)],
    "Stripe billing portal config identifier"
  ),
  literalRule("revvault-path-prod", "revvault/prod/", "revvault prod credential path"),
  literalRule("revvault-path-dev", "revvault/dev/", "revvault dev credential path"),
  literalRule("revvault-path-forge", "revvault/forge/", "revvault forge credential path"),
  literalRule("age-identity", ".age-identity", "age identity key reference"),
  literalRule("coord-paths", ".claude/coordination/", "coordination directory path"),
  literalRule("coord-workboard", "/.claude/workboard.md", "workboard.md path reference"),
  literalRule("coord-beacon", "context-beacon.json", "context-beacon.json path reference"),
  patternRule(
    "internal-handoff",
    [
      lit("/HANDOFF-"),
      run(isDigit, 4, 4),
      lit("-"),
      run(isDigit, 2, 2),
      lit("-"),
      run(isDigit, 2, 2)
    ],
    "internal handoff doc reference"
  ),
  patternRule(
    "internal-gap-id",
    [lit("GAP-"), run(isDigit, 3)],
    "internal gap/work-item identifier (private surface)"
  ),
  literalRule("internal-master-plan", "MASTER_PLAN.md", "master plan doc reference")
];

// scripts/leak-scan/scan.ts
import { lstatSync, readdirSync, readFileSync as readFileSync2 } from "node:fs";
import { join, relative } from "node:path";
var DEFAULT_EXCLUDE_DIRS = /* @__PURE__ */ new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".turbo",
  ".pnpm",
  "coverage",
  "target",
  ".direnv",
  ".nyc_output"
]);
var DEFAULT_EXCLUDE_FILE_GLOBS = [
  "pnpm-lock.yaml",
  "package-lock.json",
  "yarn.lock",
  "Cargo.lock",
  "*.png",
  "*.jpg",
  "*.jpeg",
  "*.gif",
  "*.webp",
  "*.pdf",
  "*.zip",
  "*.tar.gz",
  "*.tgz",
  "*.ico",
  "*.woff",
  "*.woff2",
  "*.ttf",
  "*.otf"
];
function isExcludedFile(name, globs) {
  for (const glob of globs) {
    if (matchGlob(name, glob)) return true;
  }
  return false;
}
function scanContent(rules, content, file) {
  const findings = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (const rule of rules) {
      if (rule.matches(line)) {
        findings.push({ tag: rule.tag, file, line: i + 1, reason: rule.reason, content: line });
      }
    }
  }
  return findings;
}
function walkFiles(root, excludeDirs, excludeFileGlobs) {
  const out = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      let isSymlink = false;
      try {
        isSymlink = lstatSync(full).isSymbolicLink();
      } catch {
        continue;
      }
      if (isSymlink) continue;
      if (entry.isDirectory()) {
        if (!excludeDirs.has(entry.name)) stack.push(full);
      } else if (entry.isFile()) {
        if (!isExcludedFile(entry.name, excludeFileGlobs)) out.push(full);
      }
    }
  }
  return out;
}
function toForwardSlashes(p) {
  return p.split("\\").join("/");
}
function scanPaths(rules, roots, opts = {}) {
  const excludeDirs = opts.excludeDirs ?? DEFAULT_EXCLUDE_DIRS;
  const excludeFileGlobs = opts.excludeFileGlobs ?? DEFAULT_EXCLUDE_FILE_GLOBS;
  const isIgnored = opts.isIgnored ?? (() => false);
  const maxBytes = opts.maxBytes ?? 5e6;
  const findings = [];
  for (const root of roots) {
    for (const file of walkFiles(root, excludeDirs, excludeFileGlobs)) {
      let content;
      try {
        const buf = readFileSync2(file);
        if (buf.length > maxBytes || buf.includes(0)) continue;
        content = buf.toString("utf8");
      } catch {
        continue;
      }
      const rel = toForwardSlashes(relative(root, file));
      for (const finding of scanContent(rules, content, file)) {
        if (!isIgnored(rel, finding.tag)) findings.push(finding);
      }
    }
  }
  return { findings, violations: findings.length };
}

// scripts/leak-scan/cli.ts
var HELP = [
  "leak-scan - detect private paths, IDs, and credentials that must not ship.",
  "",
  "Usage: leak-scan [path...] [--json] [--leakignore=FILE] [--local-rules=FILE]",
  "",
  "  path...           directories/files to scan (default: current directory)",
  "  --json            machine-readable output",
  "  --leakignore=F    allowlist file (default: <root>/.leakignore)",
  "  --local-rules=F   repo-local sensitive rules (default: <root>/.leakrules.json)",
  "",
  "Exit codes: 0 clean, 1 violations found, 2 setup error.",
  ""
].join("\n");
var SELF_EXCLUDE_GLOBS = ["leak-scan.mjs", "check-no-private-leaks.sh", ".leakrules.json"];
function runCli(argv, cwd) {
  let json = false;
  let leakignorePath;
  let localRulesPath;
  const paths = [];
  for (const arg of argv) {
    if (arg === "--json") json = true;
    else if (arg === "--help" || arg === "-h") return { code: 0, stdout: HELP, stderr: "" };
    else if (arg.startsWith("--leakignore=")) leakignorePath = arg.slice("--leakignore=".length);
    else if (arg.startsWith("--local-rules=")) localRulesPath = arg.slice("--local-rules=".length);
    else if (arg.startsWith("-"))
      return { code: 2, stdout: "", stderr: `leak-scan: unknown option ${arg}
` };
    else paths.push(arg);
  }
  const roots = paths.length > 0 ? paths : [cwd];
  const primaryRoot = roots[0] ?? cwd;
  for (const p of roots) {
    if (!existsSync2(p))
      return { code: 2, stdout: "", stderr: `leak-scan: scan path not found: ${p}
` };
  }
  let rules = BASE_RULES;
  try {
    const local = loadLocalRules(localRulesPath ?? join2(primaryRoot, ".leakrules.json"));
    if (local.length > 0) rules = [...BASE_RULES, ...local];
  } catch (err) {
    if (err instanceof ConfigError) return { code: 2, stdout: "", stderr: `${err.message}
` };
    throw err;
  }
  const leakignoreFile = leakignorePath ?? join2(primaryRoot, ".leakignore");
  const isIgnored = existsSync2(leakignoreFile) ? makeIsIgnored(parseLeakignore(readFileSync3(leakignoreFile, "utf8"))) : void 0;
  const excludeFileGlobs = [...DEFAULT_EXCLUDE_FILE_GLOBS, ...SELF_EXCLUDE_GLOBS];
  const { findings, violations } = scanPaths(rules, roots, { isIgnored, excludeFileGlobs });
  if (json) {
    return { code: violations > 0 ? 1 : 0, stdout: `${formatJson(findings)}
`, stderr: "" };
  }
  if (violations > 0) {
    return {
      code: 1,
      stdout: `${formatText(findings)}
`,
      stderr: `leak-scan: FAIL - ${violations} violation(s)
`
    };
  }
  return { code: 0, stdout: `leak-scan: OK - no leaks across ${roots.join(", ")}
`, stderr: "" };
}
if (!process.env.VITEST) {
  const result = runCli(process.argv.slice(2), process.cwd());
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.code);
}
export {
  runCli
};
