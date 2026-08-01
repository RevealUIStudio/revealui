/**
 * Phase 2.2.5 / D18.b — edge-first surface contract.
 * Static ban on Node-only modules in RSC path sources + ALS / stream smokes.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { encodeBase64Chunked, readStreamToUint8Array } from '../base64.js';
import {
  getRequest,
  getRequestOrNull,
  runWithRequest,
  runWithRequestAsync,
} from '../request-context.js';
import { Router } from '../router.js';
import { renderRequest } from '../server-rsc.js';

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..');

/** RSC / dual-mode sources that must stay free of Node-only I/O modules. */
const EDGE_PATH_FILES = [
  'actions.ts',
  'base64.ts',
  'navigation.ts',
  'negotiate.ts',
  'request-context.ts',
  'router.ts',
  'server-rsc.tsx',
  'types.ts',
] as const;

const BANNED_IMPORT = /from\s+['"]node:(fs|path|crypto|buffer|http|https|net|os|child_process)['"]/;
const BANNED_REQUIRE = /require\(\s*['"]node:(fs|path|crypto|buffer)['"]\s*\)/;
const BANNED_BUFFER = /\bBuffer\.(from|alloc|isBuffer)\b/;

describe('D18.b edge-safe RSC sources', () => {
  it('edge-path source files are present', () => {
    const names = new Set(readdirSync(srcDir));
    for (const file of EDGE_PATH_FILES) {
      expect(names.has(file), `missing ${file}`).toBe(true);
    }
  });

  it('does not import Node-only I/O modules on the RSC path', () => {
    const offenders: string[] = [];
    for (const file of EDGE_PATH_FILES) {
      const text = readFileSync(join(srcDir, file), 'utf8');
      if (BANNED_IMPORT.test(text) || BANNED_REQUIRE.test(text) || BANNED_BUFFER.test(text)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('request-context uses AsyncLocalStorage only (documented edge ALS)', () => {
    const text = readFileSync(join(srcDir, 'request-context.ts'), 'utf8');
    expect(text).toMatch(/AsyncLocalStorage/);
    expect(text).toMatch(/async_hooks/);
    expect(text).not.toMatch(BANNED_IMPORT);
  });

  it('server-ssr is isolated (may use react-dom/server; not part of edge RSC graph)', () => {
    const text = readFileSync(join(srcDir, 'server-ssr.tsx'), 'utf8');
    expect(text).toMatch(/react-dom\/server/);
    // RSC barrel may mention server-ssr in docs comments, but must not import it.
    const serverBarrel = readFileSync(join(srcDir, 'server.tsx'), 'utf8');
    expect(serverBarrel).not.toMatch(/from\s+['"]\.\/server-ssr['"]/);
    expect(serverBarrel).not.toMatch(/from\s+['"]react-dom\/server['"]/);
  });
});

describe('Web-platform smoke (edge-portable APIs)', () => {
  it('chunked base64 round-trips Uint8Array without Buffer', async () => {
    const bytes = new TextEncoder().encode('edge-payload-✓');
    const b64 = encodeBase64Chunked(bytes);
    expect(b64.length).toBeGreaterThan(0);
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(bytes);
        c.close();
      },
    });
    const out = await readStreamToUint8Array(stream);
    expect(new TextDecoder().decode(out)).toBe('edge-payload-✓');
  });

  it('ALS getRequest works under runWithRequest (Node/edge ALS)', () => {
    const req = new Request('https://example.test/a');
    expect(getRequestOrNull()).toBeNull();
    const seen = runWithRequest(req, () => getRequest());
    expect(seen).toBe(req);
  });

  it('renderRequest negotiates RSC with only Web Request/Response/Streams', async () => {
    const router = new Router({ rsc: {} });
    router.register({ path: '/', component: () => null });
    const flight = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode('1:edge'));
        c.close();
      },
    });
    const res = await renderRequest(
      new Request('https://edge.test/', { headers: { accept: 'text/x-component' } }),
      {
        router,
        createRscStream: async () => flight,
      },
    );
    expect(res.headers.get('content-type')).toMatch(/text\/x-component/);
    expect(res.headers.get('vary')?.toLowerCase()).toContain('accept');
    expect(await res.text()).toBe('1:edge');
  });

  it('runWithRequestAsync binds request across await', async () => {
    const req = new Request('https://example.test/async');
    const seen = await runWithRequestAsync(req, async () => {
      await Promise.resolve();
      return getRequest().url;
    });
    expect(seen).toBe('https://example.test/async');
  });
});
