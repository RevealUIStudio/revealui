#!/usr/bin/env node
// docs-app-hardening PR2: fail CI if public/docs-pro/** markdown lacks an
// explicit visibility frontmatter key, or if a NEVER_SERVE basename appears
// under docs-pro. Hand-tracked docs-pro is outside prune-non-public's copy
// path; this gate is the fail-closed CI assertion for that tree.
//
// Zero authored regex: line scans only (fleet hardline).

import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { NEVER_SERVE, readVisibility } from "./served-docs.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const docsProRoot = join(here, "..", "public", "docs-pro");

const problems = [];

async function walk(dir) {
  let entries;
  try {
    entries = await readdir(dir);
  } catch (err) {
    if (err && err.code === "ENOENT") {
      process.stdout.write("check-docs-pro-boundary: no public/docs-pro/ (ok)\n");
      return;
    }
    throw err;
  }
  for (const name of entries) {
    const full = join(dir, name);
    const st = await stat(full);
    if (st.isDirectory()) {
      await walk(full);
      continue;
    }
    if (!(name.endsWith(".md") || name.endsWith(".mdx"))) continue;
    const rel = relative(join(here, "..", "public"), full);
    if (NEVER_SERVE.has(basename(full))) {
      problems.push(
        `${rel} — NEVER_SERVE basename under docs-pro (remove or relocate)`,
      );
      continue;
    }
    const content = await readFile(full, "utf8");
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
