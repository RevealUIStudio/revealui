#!/usr/bin/env node

/**
 * @revealui/openapi — contracts mirror emitter (F8 Phase 3 Stage 1).
 *
 * Generates a contracts-types-only OpenAPI 3.1 doc from the
 * `@revealui/mcp` contracts catalog. Output is committed to
 * `packages/openapi/contracts.openapi.json` as a reference; the CI gate
 * fails when re-running this script produces a different output (drift
 * detection).
 *
 * Consumers — `oapi-codegen` (Go, e.g. `revdev/apps/console`) and
 * `progenitor` (Rust, e.g. `revvault` core) — read the committed JSON to
 * generate per-language type bindings, replacing hand-mirrors with a
 * single-source-of-truth codegen pipeline.
 *
 * ## Usage
 *
 * ```bash
 * pnpm --filter @revealui/openapi emit:contracts        # write the file
 * pnpm --filter @revealui/openapi check:contracts       # exit non-zero on drift
 * ```
 *
 * ## Determinism
 *
 * - No timestamps in the output (drift detection requires byte-stable emission).
 * - `info.version` is pinned to `@revealui/contracts`'s package version, NOT
 *   `@revealui/openapi`'s — the doc describes contracts schemas, so the
 *   meaningful version is the contracts package's.
 * - Component schema names use snake_case `<category>_<schemaName>` for
 *   cross-language codegen friendliness (Go / Rust generators tend to
 *   convert kebab-case awkwardly; underscore is the cleanest interchange).
 * - The root `$schema` keyword that Zod v4 emits on each schema is stripped
 *   per OpenAPI 3.1 conventions (the root `jsonSchemaDialect` field declares
 *   the dialect for the whole doc; sub-schemas don't redeclare).
 *
 * Per `docs/decisions/2026-05-03-contracts-protocol-pyramid.md` §"Phase 3".
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getContractsCatalog } from '@revealui/mcp/contracts-server';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(SCRIPT_DIR, '..');
const OUTPUT_PATH = join(PACKAGE_ROOT, 'contracts.openapi.json');

interface ContractsPackageJson {
  version: string;
}

/**
 * Resolve the `@revealui/contracts` package version at build time. The
 * emitted doc's `info.version` tracks contracts (the source of truth),
 * not `@revealui/openapi` (the carrier).
 */
function readContractsVersion(): string {
  const path = join(PACKAGE_ROOT, '..', 'contracts', 'package.json');
  const pkg = JSON.parse(readFileSync(path, 'utf8')) as ContractsPackageJson;
  return pkg.version;
}

/** Strip the root `$schema` keyword from a JSON Schema so OpenAPI's root
 *  dialect declaration governs the whole document. */
function stripRootSchemaKey(jsonSchema: unknown): unknown {
  if (!jsonSchema || typeof jsonSchema !== 'object') return jsonSchema;
  const { $schema: _ignored, ...rest } = jsonSchema as Record<string, unknown>;
  return rest;
}

interface OpenApiInfo {
  title: string;
  version: string;
  description: string;
  license: { name: string; identifier: string };
}

interface OpenApiComponents {
  schemas: Record<string, unknown>;
}

interface OpenApiSpec {
  openapi: '3.1.0';
  jsonSchemaDialect: string;
  info: OpenApiInfo;
  components: OpenApiComponents;
}

/**
 * Build the contracts OpenAPI 3.1 spec from the MCP contracts catalog.
 *
 * Pure: every call with the same `@revealui/mcp` + `@revealui/contracts`
 * inputs produces the exact same output. Drift detection in CI relies on
 * this property.
 */
export function buildContractsOpenApi(): OpenApiSpec {
  const catalog = getContractsCatalog();

  // Collect every (componentName, jsonSchema) pair, then globally sort by
  // componentName. Per-category sort isn't enough because some category
  // names are prefixes of others (e.g. `content` is a prefix of
  // `content_validation`), which breaks global alphabetical ordering when
  // components from `content_*` interleave with `content_validation_*`.
  const entries: Array<[string, unknown]> = [];
  for (const [category, categoryEntry] of Object.entries(catalog)) {
    if (!categoryEntry) continue;
    for (const [schemaName, jsonSchema] of Object.entries(categoryEntry.schemas)) {
      const componentName = `${category}_${schemaName}`;
      entries.push([componentName, stripRootSchemaKey(jsonSchema)]);
    }
  }
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  const schemas: Record<string, unknown> = {};
  for (const [componentName, jsonSchema] of entries) {
    schemas[componentName] = jsonSchema;
  }

  const contractsVersion = readContractsVersion();

  return {
    openapi: '3.1.0',
    jsonSchemaDialect: 'https://json-schema.org/draft/2020-12/schema',
    info: {
      title: 'RevealUI Contracts (Types Mirror)',
      version: contractsVersion,
      description:
        'OpenAPI 3.1 mirror of `@revealui/contracts` Zod schemas, emitted by ' +
        "`@revealui/openapi`'s `scripts/emit-from-mcp.ts` from the MCP " +
        'contracts catalog. Drives cross-language codegen (Go via ' +
        '`oapi-codegen`, Rust via `progenitor`) so per-language consumers ' +
        'replace hand-mirrors with generated types from a single source of ' +
        'truth. See the internal contracts-protocol-pyramid ADR (2026-05-03) ' +
        '§Phase 3.',
      license: { name: 'MIT', identifier: 'MIT' },
    },
    components: { schemas },
  };
}

/**
 * Serialize the spec to a stable JSON string. Trailing newline matches
 * POSIX convention + `git diff` cleanliness.
 */
export function serializeContractsOpenApi(spec: OpenApiSpec): string {
  return `${JSON.stringify(spec, null, 2)}\n`;
}

function isMain(): boolean {
  if (typeof process === 'undefined' || !process.argv[1]) return false;
  const argv1Url = `file://${process.argv[1].replaceAll('\\', '/')}`;
  return import.meta.url === argv1Url || import.meta.url === `file://${process.argv[1]}`;
}

if (isMain()) {
  const checkOnly = process.argv.includes('--check');
  const spec = buildContractsOpenApi();
  const serialized = serializeContractsOpenApi(spec);
  const componentCount = Object.keys(spec.components.schemas).length;

  if (checkOnly) {
    let existing = '';
    try {
      existing = readFileSync(OUTPUT_PATH, 'utf8');
    } catch {
      process.stderr.write(
        `[emit-from-mcp] check failed: ${OUTPUT_PATH} does not exist. Run \`pnpm --filter @revealui/openapi emit:contracts\` to generate it.\n`,
      );
      process.exit(2);
    }
    if (existing !== serialized) {
      process.stderr.write(
        `[emit-from-mcp] check failed: ${OUTPUT_PATH} differs from regenerated output. Run \`pnpm --filter @revealui/openapi emit:contracts\` to update + commit.\n`,
      );
      process.exit(1);
    }
    process.stdout.write(
      `[emit-from-mcp] check ok — ${componentCount} components match committed reference.\n`,
    );
    process.exit(0);
  }

  writeFileSync(OUTPUT_PATH, serialized, 'utf8');
  process.stdout.write(`[emit-from-mcp] wrote ${componentCount} components → ${OUTPUT_PATH}\n`);
}
