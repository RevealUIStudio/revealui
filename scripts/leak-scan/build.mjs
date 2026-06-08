// Build the dependency-free single-file scanner bundle from the TS source.
//
//   node scripts/leak-scan/build.mjs           write scripts/leak-scan/leak-scan.mjs
//   node scripts/leak-scan/build.mjs --check    exit 1 if the committed bundle is stale
//
// Uses the workspace esbuild binary. The bundle imports only node: builtins, so
// consuming repos run it with plain `node leak-scan.mjs` — no install, no tsx.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const esbuild = join(repoRoot, "node_modules", ".bin", "esbuild");
const entry = join(here, "cli.ts");
const committed = join(here, "leak-scan.mjs");
const check = process.argv.includes("--check");

const outfile = check ? join(mkdtempSync(join(tmpdir(), "leakbuild-")), "leak-scan.mjs") : committed;

execFileSync(
  esbuild,
  [entry, "--bundle", "--platform=node", "--format=esm", "--target=node20", `--outfile=${outfile}`],
  { stdio: ["ignore", "ignore", "inherit"] },
);

if (check) {
  const fresh = readFileSync(outfile, "utf8");
  rmSync(dirname(outfile), { recursive: true, force: true });
  if (fresh !== readFileSync(committed, "utf8")) {
    process.stderr.write("leak-scan: leak-scan.mjs is stale - run `node scripts/leak-scan/build.mjs`\n");
    process.exit(1);
  }
  process.stdout.write("leak-scan: bundle up to date\n");
} else {
  process.stdout.write(`leak-scan: built ${committed}\n`);
}
