#!/usr/bin/env node
// docs-app-hardening PR2: fail CI if public/docs-pro/** markdown lacks an
// explicit visibility frontmatter key, or if a NEVER_SERVE basename appears
// under docs-pro. Hand-tracked docs-pro is outside prune-non-public's copy
// path; this gate is the fail-closed CI assertion for that tree.
//
// Zero authored regex: line scans only (fleet hardline).
// Dirent-based walk (no stat-then-read TOCTOU — CodeQL js/file-system-race).

import { readdir, readFile } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { NEVER_SERVE, readVisibility } from "./served-docs.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const docsProRoot = join(here, "..", "public", "docs-pro");
const publicRoot = join(here, "..", "public");

const problems = [];

async function walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err && err.code === "ENOENT") {
      process.stdout.write("check-docs-pro-boundary: no public/docs-pro/ (ok)\n");
      return;
    }
    throw err;
  }
  for (const ent of entries) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      await walk(full);
      continue;
    }
    if (!ent.isFile()) continue;
    if (!(ent.name.endsWith(".md") || ent.name.endsWith(".mdx"))) continue;
    const rel = relative(publicRoot, full);
    if (NEVER_SERVE.has(basename(full))) {
      problems.push(
        `${rel} — NEVER_SERVE basename under docs-pro (remove or relocate)`,
      );
      continue;
    }
    // Single open: read only; no prior exists/stat race.
    let content;
    try {
      content = await readFile(full, "utf8");
    } catch (err) {
      problems.push(`${rel} — unreadable (${err && err.code ? err.code : "error"})`);
      continue;
    }
    const vis = readVisibility(content);
    if (vis === null) {
      problems.push(
        `${rel} — missing visibility frontmatter (require visibility: public|internal|pro)`,
      );
    }
  }
}

await walk(docsProRoot);

if (problems.length) {
  process.stderr.write(`check-docs-pro-boundary: ${problems.length} violation(s)\n`);
  for (const p of problems) process.stderr.write(`  ${p}\n`);
  process.exit(1);
}
process.stdout.write("check-docs-pro-boundary: ok\n");
