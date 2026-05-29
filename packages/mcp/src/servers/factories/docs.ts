/**
 * Factory for the `revealui-docs` MCP server — first-party dependency
 * intelligence.
 *
 * This is the RevealUI-native answer to external "library docs" MCP servers
 * (e.g. context7): instead of routing queries to a third-party service, it
 * serves curated docs for the fleet's own `@revealui/*` packages straight
 * from the monorepo — README + package.json metadata + public export
 * subpaths. Source is ground truth, and it covers first-party packages an
 * external indexer cannot see at all.
 *
 * ## Phase 1 (this file)
 *
 * First-party `@revealui/*` packages only. Tools:
 * - `docs_list_libraries` — enumerate every first-party package.
 * - `docs_resolve_library` — normalize a name ("router", "@revealui/router")
 *   to its canonical id.
 * - `docs_get_library` — return curated docs for a package.
 *
 * Resource:
 * - `revealui-docs://catalog` — the same list as `docs_list_libraries`.
 *
 * npm / third-party packages are out of scope for P1. `opensrc` already
 * fetches real dependency source on demand; a later phase wires it in behind
 * the same two tools so the ergonomics stay uniform.
 *
 * ## License
 *
 * **Not** Pro-gated. It surfaces only source-visible package metadata +
 * READMEs (the `@revealui/*` packages are MIT or source-visible FSL) and is a
 * developer tool for building on RevealUI — same rationale as the contracts
 * server. Revisit only if it ever serves runtime/customer data.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  type CallToolRequest,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  type ReadResourceRequest,
  ReadResourceRequestSchema,
  type Resource,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';

const SERVER_NAME = 'revealui-docs';
const SERVER_VERSION = '0.1.0';

const SCOPE_PREFIX = '@revealui/';
const RESOURCE_URI_PREFIX = 'revealui-docs://';
const CATALOG_URI = `${RESOURCE_URI_PREFIX}catalog`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A first-party package discovered in the monorepo. */
export interface PackageEntry {
  /** Canonical package name, e.g. `@revealui/router`. */
  name: string;
  /** Scope-stripped id, e.g. `router`. */
  shortId: string;
  /** Absolute path to the package directory. */
  dir: string;
  version: string;
  description: string;
  license?: string;
  homepage?: string;
  /** Public export subpaths from package.json `exports`, e.g. `['.', './server']`. */
  exports: string[];
}

/** Curated docs for a single package. */
export interface LibraryDoc {
  name: string;
  shortId: string;
  version: string;
  description: string;
  license?: string;
  homepage?: string;
  exports: string[];
  /** README.md contents, or null when the package has none. */
  readme: string | null;
}

export interface ResolveResult {
  resolved: boolean;
  /** Canonical id when resolved. */
  id?: string;
  query: string;
  /** Guidance when unresolved (e.g. third-party packages). */
  hint?: string;
  /** Near matches (substring) when unresolved. */
  candidates?: string[];
}

// ---------------------------------------------------------------------------
// Filesystem helpers
// ---------------------------------------------------------------------------

function readJson(file: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function extractExports(pkg: Record<string, unknown>): string[] {
  const ex = pkg.exports;
  if (ex && typeof ex === 'object' && !Array.isArray(ex)) {
    const keys = Object.keys(ex as Record<string, unknown>);
    return keys.length > 0 ? keys : ['.'];
  }
  return ['.'];
}

// ---------------------------------------------------------------------------
// Enumeration + lookup (pure — exported for tests + reuse)
// ---------------------------------------------------------------------------

/**
 * Enumerate first-party packages under `<root>/packages/*`. Only entries
 * whose package.json `name` is in the `@revealui/` scope (or the bare
 * `revealui` meta-package) are included. Returns a map keyed by canonical
 * package name. Never throws — unreadable entries are skipped.
 */
export function enumeratePackages(root: string): Map<string, PackageEntry> {
  const out = new Map<string, PackageEntry>();
  const pkgsDir = join(root, 'packages');
  if (!existsSync(pkgsDir)) return out;

  let names: string[];
  try {
    names = readdirSync(pkgsDir);
  } catch {
    return out;
  }

  for (const entry of names) {
    const dir = join(pkgsDir, entry);
    try {
      if (!statSync(dir).isDirectory()) continue;
    } catch {
      continue;
    }
    const pkg = readJson(join(dir, 'package.json'));
    if (!pkg) continue;
    const pkgName = asString(pkg.name);
    if (!pkgName) continue;
    const isFirstParty = pkgName.startsWith(SCOPE_PREFIX) || pkgName === 'revealui';
    if (!isFirstParty) continue;
    const shortId = pkgName.startsWith(SCOPE_PREFIX) ? pkgName.slice(SCOPE_PREFIX.length) : pkgName;
    out.set(pkgName, {
      name: pkgName,
      shortId,
      dir,
      version: asString(pkg.version) ?? '0.0.0',
      description: asString(pkg.description) ?? '',
      license: asString(pkg.license),
      homepage: asString(pkg.homepage),
      exports: extractExports(pkg),
    });
  }
  return out;
}

/** Normalize a user query to a scope-stripped, lowercased short id. */
function normalizeQuery(input: string): string {
  let s = input.trim().toLowerCase();
  if (s.startsWith(SCOPE_PREFIX)) s = s.slice(SCOPE_PREFIX.length);
  else if (s.startsWith('revealui/')) s = s.slice('revealui/'.length);
  return s;
}

function looksThirdParty(input: string): boolean {
  const s = input.trim().toLowerCase();
  if (!s) return false;
  // A scoped name from another org, e.g. "@hono/node-server", or a bare npm
  // name we don't recognize. Both are out of P1 scope.
  return s.startsWith('@') && !s.startsWith(SCOPE_PREFIX);
}

/** Resolve a library name to a canonical first-party id. */
export function resolveLibrary(packages: Map<string, PackageEntry>, input: string): ResolveResult {
  const query = input.trim();
  if (!query) {
    return {
      resolved: false,
      query,
      hint: 'Provide a package name, e.g. "router" or "@revealui/router".',
    };
  }
  const shortId = normalizeQuery(query);

  // Exact full-name match first, then short-id match.
  for (const entry of packages.values()) {
    if (entry.name === query || entry.shortId === shortId) {
      return { resolved: true, id: entry.name, query };
    }
  }

  const npmHint =
    'Phase 1 of revealui-docs covers first-party @revealui/* packages only. ' +
    'For an npm/third-party package, fetch its source with `opensrc <package>` ' +
    '(a later phase will wire that in behind this tool).';
  const candidates = [...packages.values()]
    .filter((e) => e.shortId.includes(shortId) || e.name.includes(shortId))
    .map((e) => e.name);

  return {
    resolved: false,
    query,
    hint: looksThirdParty(query)
      ? npmHint
      : `No first-party package matches "${query}". ${npmHint}`,
    candidates: candidates.length > 0 ? candidates : undefined,
  };
}

/** Read curated docs for a resolved package id (canonical name or short id). */
export function getLibraryDoc(packages: Map<string, PackageEntry>, id: string): LibraryDoc | null {
  const resolved = resolveLibrary(packages, id);
  if (!(resolved.resolved && resolved.id)) return null;
  const entry = packages.get(resolved.id);
  if (!entry) return null;

  let readme: string | null = null;
  const readmePath = join(entry.dir, 'README.md');
  if (existsSync(readmePath)) {
    try {
      readme = readFileSync(readmePath, 'utf8');
    } catch {
      readme = null;
    }
  }

  return {
    name: entry.name,
    shortId: entry.shortId,
    version: entry.version,
    description: entry.description,
    license: entry.license,
    homepage: entry.homepage,
    exports: entry.exports,
    readme,
  };
}

interface LibrarySummary {
  name: string;
  shortId: string;
  version: string;
  description: string;
  exports: string[];
}

/** Summaries of every first-party package, sorted by name. */
export function listLibraries(packages: Map<string, PackageEntry>): LibrarySummary[] {
  return [...packages.values()]
    .map((e) => ({
      name: e.name,
      shortId: e.shortId,
      version: e.version,
      description: e.description,
      exports: e.exports,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// Tool + resource catalogs
// ---------------------------------------------------------------------------

function buildToolList(): Tool[] {
  return [
    {
      name: 'docs_list_libraries',
      description:
        'List every first-party @revealui/* package available to this docs server, with version, description, and public export subpaths.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'docs_resolve_library',
      description:
        'Resolve a library name (e.g. "router", "@revealui/router") to its canonical first-party id. Returns guidance for third-party/npm packages (out of Phase 1 scope).',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Library name to resolve.' },
        },
        required: ['name'],
      },
    },
    {
      name: 'docs_get_library',
      description:
        'Return curated docs for a first-party package: README + description + version + license + public export subpaths. Accepts a canonical name or a short id.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Canonical name ("@revealui/router") or short id ("router").',
          },
        },
        required: ['id'],
      },
    },
  ];
}

function textResult(
  value: unknown,
  isError = false,
): {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
} {
  const result: {
    content: Array<{ type: 'text'; text: string }>;
    isError?: boolean;
  } = { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
  if (isError) result.isError = true;
  return result;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface CreateDocsServerOptions {
  /** Monorepo root containing `packages/`. The launcher resolves this. */
  root: string;
  /** Override the advertised server name (useful for tests). */
  serverName?: string;
}

/**
 * Create a fresh `revealui-docs` MCP Server. The package list is enumerated
 * once at creation (cheap, name+metadata only); README contents are read
 * lazily per `docs_get_library` call.
 */
export function createDocsServer(options: CreateDocsServerOptions): Server {
  const packages = enumeratePackages(options.root);

  const server = new Server(
    { name: options.serverName ?? SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {}, resources: {} } },
  );

  const toolList = buildToolList();
  const resourceList: Resource[] = [
    {
      uri: CATALOG_URI,
      name: 'catalog',
      description:
        'List of first-party @revealui/* packages with version, description, and exports.',
      mimeType: 'application/json',
    },
  ];

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: toolList }));

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: resourceList }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request: ReadResourceRequest) => {
    const uri = request.params.uri;
    if (uri !== CATALOG_URI) {
      throw new Error(`Unknown resource URI (expected ${CATALOG_URI}): ${uri}`);
    }
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(
            { libraries: listLibraries(packages), total: packages.size },
            null,
            2,
          ),
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
    const toolName = request.params.name;
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;
    try {
      if (toolName === 'docs_list_libraries') {
        return textResult({ libraries: listLibraries(packages), total: packages.size });
      }

      if (toolName === 'docs_resolve_library') {
        const name = args.name;
        if (typeof name !== 'string') {
          return textResult({ error: '"name" (string) is required.' }, true);
        }
        return textResult(resolveLibrary(packages, name));
      }

      if (toolName === 'docs_get_library') {
        const id = args.id;
        if (typeof id !== 'string') {
          return textResult({ error: '"id" (string) is required.' }, true);
        }
        const doc = getLibraryDoc(packages, id);
        if (!doc) {
          return textResult(resolveLibrary(packages, id), true);
        }
        return textResult(doc);
      }

      return textResult({ error: `Unknown tool: ${toolName}` }, true);
    } catch (err) {
      return textResult({ error: err instanceof Error ? err.message : String(err) }, true);
    }
  });

  return server;
}
