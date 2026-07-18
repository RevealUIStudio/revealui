import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  chmodSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { dirname, extname, join, normalize } from 'node:path';
import type { DaemonStore } from '../storage/daemon-store.js';
import type { RpcServer } from './rpc-server.js';
import type { AgentExitEvent, AgentOutputEvent, SpawnerService } from './spawner-service.js';

/**
 * HTTP gateway that exposes the harness daemon over TCP.
 *
 * Routes:
 *   POST /rpc                -  JSON-RPC 2.0 proxy (same protocol as Unix socket)
 *   GET  /api/pair           -  Issue a single-use pairing nonce (pre-auth)
 *   POST /api/pair           -  Submit an HMAC challenge response, receive a bearer token (pre-auth)
 *   GET  /api/status         -  Daemon status summary (requires a valid token)
 *   GET  /api/stream/:id     -  SSE stream of agent output (requires a valid token)
 *   GET  /                   -  Serves Studio static frontend (index.html)
 *   GET  /assets/*           -  Serves static assets
 *
 * Auth (fail-closed):
 *   Every /rpc and /api/* request EXCEPT the pairing endpoints (see PRE_AUTH_ROUTES)
 *   requires `Authorization: Bearer <token>`, where the token's SHA-256 hash matches a
 *   durable, unexpired, unrevoked row in `gateway_tokens`. There is no pre-pairing
 *   bypass: a never-paired daemon refuses every RPC (including agent.spawn / agent.stop).
 *
 * Pairing (challenge-response, secret never crosses the wire):
 *   GET /api/pair returns a nonce; the operator computes HMAC-SHA256(secret, nonce) with
 *   the 32-byte secret from the 0600 file in the daemon data dir and POSTs it back. The
 *   server verifies against the same file secret with a timing-safe comparison, then mints
 *   a durable bearer token. The stored DB hash (gateway_bootstrap) detects file tampering
 *   or substitution; the file itself is the HMAC key.
 */

/** Tunable auth parameters (defaults applied in the constructor). */
export interface AuthTuning {
  /** Bearer-token lifetime in ms (default: 90 days). */
  tokenTtlMs?: number;
  /** Pairing-nonce lifetime in ms (default: 2 minutes). */
  nonceTtlMs?: number;
  /** Failed pairing attempts per source before lockout kicks in (default: 5). */
  lockoutThreshold?: number;
  /** Base lockout duration in ms; doubles per failure past the threshold (default: 60s). */
  baseLockoutMs?: number;
  /** Ceiling on lockout duration in ms (default: 1 hour). */
  maxLockoutMs?: number;
  /** Global failed-attempt ceiling before a fleet-wide cooldown (default: 100). */
  globalFailureCeiling?: number;
  /** Clock source (default: Date.now); injectable for deterministic tests. */
  now?: () => number;
}

export interface HttpGatewayConfig {
  /** TCP port to listen on (default: 7890; pass 0 to bind an ephemeral port) */
  port: number;
  /** Bind address (default: '0.0.0.0' for Tailscale access) */
  host: string;
  /** Path to Studio static build directory (optional  -  disables static serving if absent) */
  staticDir?: string;
  /** Reference to the Unix-socket RPC server for dispatching */
  rpcDispatch: RpcServer;
  /** Reference to the spawner service (enables SSE streaming) */
  spawner?: SpawnerService;
  /** Durable daemon store (bootstrap secret hash + hashed bearer tokens) */
  store: DaemonStore;
  /** Absolute path to the 0600 bootstrap pairing secret file */
  secretPath: string;
  /** Optional auth tuning (TTLs, lockout, clock) */
  authTuning?: AuthTuning;
}

/**
 * The EXACT set of routes served before authentication. Everything else under
 * `/rpc` and `/api/*` requires a valid bearer token. Exported so the allowlist is a
 * verifiable constant rather than emergent routing behavior (spec §7 R3).
 */
export const PRE_AUTH_ROUTES: ReadonlyArray<{ readonly method: string; readonly path: string }> = [
  { method: 'GET', path: '/api/pair' },
  { method: 'POST', path: '/api/pair' },
];

/** Whether a (method, path) pair is served without authentication. */
export function isPreAuthRoute(method: string, path: string): boolean {
  for (const route of PRE_AUTH_ROUTES) {
    if (route.method === method && route.path === path) return true;
  }
  return false;
}

const DEFAULT_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const DEFAULT_NONCE_TTL_MS = 2 * 60 * 1000;
const DEFAULT_LOCKOUT_THRESHOLD = 5;
const DEFAULT_BASE_LOCKOUT_MS = 60 * 1000;
const DEFAULT_MAX_LOCKOUT_MS = 60 * 60 * 1000;
const DEFAULT_GLOBAL_FAILURE_CEILING = 100;
const MAX_PENDING_NONCES = 256;
const SECRET_BYTES = 32;
const NONCE_BYTES = 32;
const TOKEN_BYTES = 32;

/** MIME types for static file serving */
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
};

interface RateLimiterConfig {
  now: () => number;
  lockoutThreshold: number;
  baseLockoutMs: number;
  maxLockoutMs: number;
  globalCeiling: number;
}

/**
 * Per-source failed-attempt tracker for the pairing endpoint: exponential backoff
 * with a lockout ceiling, plus a coarse global cooldown. In-memory only (a pairing
 * flood is transient and pre-auth); state resets on restart per spec §D5/§7 R6.
 */
export class PairingRateLimiter {
  private readonly perSource = new Map<string, { failures: number; lockedUntil: number }>();
  private globalFailures = 0;
  private globalLockedUntil = 0;

  constructor(private readonly cfg: RateLimiterConfig) {}

  /** Milliseconds until this source (or the whole gateway) may attempt again; 0 if clear. */
  retryAfterMs(source: string): number {
    const now = this.cfg.now();
    if (now < this.globalLockedUntil) return this.globalLockedUntil - now;
    const rec = this.perSource.get(source);
    if (rec && now < rec.lockedUntil) return rec.lockedUntil - now;
    return 0;
  }

  /** Clear a source's failure history after a successful pairing. */
  recordSuccess(source: string): void {
    this.perSource.delete(source);
  }

  /** Record a failed attempt; returns the resulting lockout for this source and the global state. */
  recordFailure(source: string): { failures: number; lockMs: number; globalTripped: boolean } {
    const now = this.cfg.now();
    const rec = this.perSource.get(source) ?? { failures: 0, lockedUntil: 0 };
    rec.failures += 1;
    let lockMs = 0;
    if (rec.failures >= this.cfg.lockoutThreshold) {
      const over = rec.failures - this.cfg.lockoutThreshold;
      lockMs = Math.min(this.cfg.baseLockoutMs * 2 ** over, this.cfg.maxLockoutMs);
      rec.lockedUntil = now + lockMs;
    }
    this.perSource.set(source, rec);

    this.globalFailures += 1;
    let globalTripped = false;
    if (this.globalFailures >= this.cfg.globalCeiling) {
      this.globalLockedUntil = now + this.cfg.baseLockoutMs;
      this.globalFailures = 0;
      globalTripped = true;
    }
    return { failures: rec.failures, lockMs, globalTripped };
  }
}

export class HttpGateway {
  private server: Server;
  private readonly config: HttpGatewayConfig;

  /** The 32-byte file secret (hex string) used to key pairing HMACs; null when unusable. */
  private bootstrapSecret: string | null = null;
  /** Outstanding single-use pairing nonces → expiry (ms epoch). */
  private readonly nonces = new Map<string, number>();
  private readonly rateLimiter: PairingRateLimiter;
  private readonly now: () => number;
  private readonly tokenTtlMs: number;
  private readonly nonceTtlMs: number;

  constructor(config: HttpGatewayConfig) {
    this.config = config;
    const t = config.authTuning ?? {};
    this.now = t.now ?? (() => Date.now());
    this.tokenTtlMs = t.tokenTtlMs ?? DEFAULT_TOKEN_TTL_MS;
    this.nonceTtlMs = t.nonceTtlMs ?? DEFAULT_NONCE_TTL_MS;
    this.rateLimiter = new PairingRateLimiter({
      now: this.now,
      lockoutThreshold: t.lockoutThreshold ?? DEFAULT_LOCKOUT_THRESHOLD,
      baseLockoutMs: t.baseLockoutMs ?? DEFAULT_BASE_LOCKOUT_MS,
      maxLockoutMs: t.maxLockoutMs ?? DEFAULT_MAX_LOCKOUT_MS,
      globalCeiling: t.globalFailureCeiling ?? DEFAULT_GLOBAL_FAILURE_CEILING,
    });
    this.server = createServer((req, res) => {
      void this.handleRequest(req, res);
    });
  }

  /** Absolute path to the bootstrap pairing secret file (never its value). */
  getSecretPath(): string {
    return this.config.secretPath;
  }

  /**
   * Prepare fail-closed auth state. Must run before start() serves requests.
   *
   * Reconciles the 0600 secret file with the persisted hash (gateway_bootstrap):
   *   - fresh (no file, no hash): generate a 32-byte 0600 secret and persist its hash.
   *   - fresh DB + existing file (§7 R5): re-hash the file into the new store.
   *   - file + matching hash: adopt the file secret as the HMAC key.
   *   - file present, hash mismatch (§D7): possible substitution  -  refuse new pairings.
   *   - file missing, hash on record (§D7): file removed  -  refuse new pairings (tokens still work).
   *   - permissive mode (§D7): group/other-readable  -  refuse to use it.
   */
  async initAuth(): Promise<void> {
    const secretPath = this.config.secretPath;
    const dbHash = await this.config.store.getBootstrapSecretHash();

    if (existsSync(secretPath)) {
      const mode = statSync(secretPath).mode & 0o777;
      if ((mode & 0o077) !== 0) {
        this.bootstrapSecret = null;
        this.logAuth(
          `bootstrap secret at ${secretPath} is group/other-accessible (mode ${mode.toString(8)}); refusing to use it  -  run: chmod 600 ${secretPath}`,
        );
        return;
      }
      const contents = readFileSync(secretPath, 'utf8').trim();
      if (contents.length === 0) {
        this.bootstrapSecret = null;
        this.logAuth(`bootstrap secret file at ${secretPath} is empty; refusing new pairings`);
        return;
      }
      const fileHash = sha256Hex(contents);
      if (dbHash === null) {
        await this.config.store.putBootstrapSecretHash(fileHash);
        this.bootstrapSecret = contents;
        this.logAuth('adopted an existing bootstrap secret file into a fresh store');
      } else if (dbHash === fileHash) {
        this.bootstrapSecret = contents;
      } else {
        this.bootstrapSecret = null;
        this.logAuth(
          `bootstrap secret at ${secretPath} does not match the recorded hash (possible substitution); refusing new pairings until it is regenerated`,
        );
      }
      return;
    }

    // File missing.
    if (dbHash !== null) {
      this.bootstrapSecret = null;
      this.logAuth(
        `bootstrap secret file ${secretPath} is missing but a hash is on record; refusing new pairings (existing tokens still work). Regenerate the file to re-enable pairing.`,
      );
      return;
    }

    // Truly fresh: create the fail-closed bootstrap secret (only if absent).
    mkdirSync(dirname(secretPath), { recursive: true });
    const secret = randomBytes(SECRET_BYTES).toString('hex');
    writeFileSync(secretPath, secret, { mode: 0o600 });
    chmodSync(secretPath, 0o600);
    await this.config.store.putBootstrapSecretHash(sha256Hex(secret));
    this.bootstrapSecret = secret;
    this.logAuth(`generated a new bootstrap pairing secret at ${secretPath} (mode 0600)`);
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.config.port, this.config.host, () => resolve());
      this.server.once('error', reject);
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => this.server.close(() => resolve()));
  }

  /** The bound TCP port (useful when constructed with port 0). */
  getPort(): number {
    const addr = this.server.address();
    return addr && typeof addr === 'object' ? addr.port : this.config.port;
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const path = url.pathname;
      const method = req.method ?? 'GET';

      // CORS headers for mobile browser access
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      // API / RPC namespace  -  fail-closed except the explicit pairing allowlist.
      if (path === '/rpc' || path.startsWith('/api/')) {
        if (!(isPreAuthRoute(method, path) || (await this.checkAuth(req, res)))) {
          return;
        }

        if (path === '/api/pair' && method === 'GET') {
          this.handleIssueNonce(res);
          return;
        }
        if (path === '/api/pair' && method === 'POST') {
          this.handlePair(req, res);
          return;
        }
        if (path === '/rpc' && method === 'POST') {
          this.handleRpc(req, res);
          return;
        }
        if (path === '/api/status') {
          this.handleStatus(res);
          return;
        }
        if (path.startsWith('/api/stream') && method === 'GET') {
          const sessionFilter = path.split('/')[3] ?? null; // optional session ID filter
          this.handleStream(req, res, sessionFilter);
          return;
        }

        jsonResponse(res, 404, { error: 'Not found' });
        return;
      }

      // Static file serving (Studio SPA shell  -  carries no data without a token).
      this.handleStatic(path, res);
    } catch (err) {
      this.logAuth(`request handling error: ${err instanceof Error ? err.message : 'unknown'}`);
      if (!res.headersSent) jsonResponse(res, 500, { error: 'Internal error' });
    }
  }

  /** Verify `Authorization: Bearer <token>` against the durable token store. */
  private async checkAuth(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const authHeader = req.headers.authorization ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      jsonResponse(res, 401, { error: 'Authorization required' });
      return false;
    }

    const presented = authHeader.slice(7);
    if (presented.length === 0) {
      jsonResponse(res, 401, { error: 'Authorization required' });
      return false;
    }

    const presentedHash = sha256Hex(presented);
    const row = await this.config.store.findValidToken(presentedHash);
    if (!row) {
      jsonResponse(res, 401, { error: 'Invalid or expired token' });
      return false;
    }

    // The store matched on hash equality; a constant-time re-check keeps token
    // verification timing-independent even if that predicate ever loosens.
    const a = Buffer.from(presentedHash, 'hex');
    const b = Buffer.from(row.token_hash, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      jsonResponse(res, 401, { error: 'Invalid or expired token' });
      return false;
    }

    return true;
  }

  /** GET /api/pair  -  issue a single-use, short-lived pairing nonce. */
  private handleIssueNonce(res: ServerResponse): void {
    this.pruneNonces();
    if (this.nonces.size >= MAX_PENDING_NONCES) {
      jsonResponse(res, 503, { error: 'Too many pending pairings; try again shortly' });
      return;
    }
    const nonce = randomBytes(NONCE_BYTES).toString('hex');
    this.nonces.set(nonce, this.now() + this.nonceTtlMs);
    jsonResponse(res, 200, { nonce, expiresIn: Math.floor(this.nonceTtlMs / 1000) });
  }

  private pruneNonces(): void {
    const now = this.now();
    for (const [nonce, expiresAt] of this.nonces) {
      if (expiresAt <= now) this.nonces.delete(nonce);
    }
  }

  /** POST /api/pair  -  verify an HMAC challenge response and mint a durable token. */
  private handlePair(req: IncomingMessage, res: ServerResponse): void {
    const source = req.socket.remoteAddress ?? 'unknown';
    const wait = this.rateLimiter.retryAfterMs(source);
    if (wait > 0) {
      this.logAuth(
        `pairing attempt from a locked-out source; ${Math.ceil(wait / 1000)}s remaining`,
      );
      jsonResponse(res, 429, { error: 'Too many attempts', retryAfter: Math.ceil(wait / 1000) });
      return;
    }

    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
      if (body.length > 1024) {
        res.writeHead(413);
        res.end();
        req.destroy();
      }
    });
    req.on('end', () => {
      void this.completePair(res, body, source);
    });
  }

  private async completePair(res: ServerResponse, body: string, source: string): Promise<void> {
    if (this.bootstrapSecret === null) {
      // §D7 refusal state  -  a server condition, not the client's fault; do not penalize the source.
      this.logAuth('pairing requested but the bootstrap secret is unavailable; refusing');
      jsonResponse(res, 503, { error: 'Pairing is disabled' });
      return;
    }

    let nonce: string;
    let hmac: string;
    let label: string | null = null;
    try {
      const parsed = JSON.parse(body) as { nonce?: unknown; hmac?: unknown; label?: unknown };
      if (typeof parsed.nonce !== 'string' || typeof parsed.hmac !== 'string') {
        jsonResponse(res, 400, { error: 'nonce and hmac are required' });
        return;
      }
      nonce = parsed.nonce;
      hmac = parsed.hmac;
      if (typeof parsed.label === 'string') label = parsed.label.slice(0, 128);
    } catch {
      jsonResponse(res, 400, { error: 'Invalid JSON' });
      return;
    }

    // Consume the nonce (single-use): remove it before verifying so it cannot be replayed,
    // whether the attempt succeeds or fails.
    const nonceExpiry = this.nonces.get(nonce);
    this.nonces.delete(nonce);
    if (nonceExpiry === undefined || nonceExpiry <= this.now()) {
      this.registerPairFailure(source, 'unknown or expired nonce');
      jsonResponse(res, 403, { error: 'Invalid or expired nonce' });
      return;
    }

    const expected = createHmac('sha256', this.bootstrapSecret).update(nonce).digest();
    const presented = Buffer.from(hmac, 'hex');
    const ok = expected.length === presented.length && timingSafeEqual(expected, presented);
    if (!ok) {
      this.registerPairFailure(source, 'incorrect pairing response');
      jsonResponse(res, 403, { error: 'Invalid pairing response' });
      return;
    }

    this.rateLimiter.recordSuccess(source);

    const token = randomBytes(TOKEN_BYTES).toString('hex');
    const expiresAt = new Date(this.now() + this.tokenTtlMs).toISOString();
    await this.config.store.insertToken({ tokenHash: sha256Hex(token), expiresAt, label });
    await this.config.store.pruneExpiredTokens();
    this.logAuth('issued a new bearer token via successful pairing');
    jsonResponse(res, 200, { token, expiresAt });
  }

  private registerPairFailure(source: string, reason: string): void {
    const { failures, lockMs, globalTripped } = this.rateLimiter.recordFailure(source);
    const lockNote = lockMs > 0 ? `; locked out ${Math.ceil(lockMs / 1000)}s` : '';
    this.logAuth(`pairing failure from ${source} (${reason}); failures=${failures}${lockNote}`);
    if (globalTripped) {
      this.logAuth('global pairing-failure ceiling reached; applying a global cooldown');
    }
  }

  /** GET /api/status  -  daemon status summary (auth required). */
  private handleStatus(res: ServerResponse): void {
    jsonResponse(res, 200, {
      daemon: 'revdev-harness',
      pid: process.pid,
      uptime: process.uptime(),
    });
  }

  /** POST /rpc  -  proxy JSON-RPC to the daemon's dispatch */
  private handleRpc(req: IncomingMessage, res: ServerResponse): void {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
      // 1MB limit for RPC payloads
      if (body.length > 1_048_576) {
        res.writeHead(413);
        res.end();
        req.destroy();
      }
    });
    req.on('end', () => {
      // Delegate to the RPC server's dispatch by simulating a socket write
      // We write the JSON line to the dispatch method directly
      this.config.rpcDispatch.dispatchHttp(body, (response) => {
        jsonResponse(res, 200, response);
      });
    });
  }

  /** GET /api/stream[/:sessionId]  -  SSE for agent output and exit events */
  private handleStream(
    req: IncomingMessage,
    res: ServerResponse,
    sessionFilter: string | null,
  ): void {
    const spawner = this.config.spawner;
    if (!spawner) {
      jsonResponse(res, 503, { error: 'Spawner not available' });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    // Send initial keepalive
    res.write(': connected\n\n');

    const onOutput = (evt: AgentOutputEvent): void => {
      if (sessionFilter && evt.sessionId !== sessionFilter) return;
      res.write(`event: output\ndata: ${JSON.stringify(evt)}\n\n`);
    };

    const onExit = (evt: AgentExitEvent): void => {
      if (sessionFilter && evt.sessionId !== sessionFilter) return;
      res.write(`event: exit\ndata: ${JSON.stringify(evt)}\n\n`);
    };

    spawner.on('output', onOutput);
    spawner.on('exit', onExit);

    // Keepalive every 30s to prevent proxy/firewall timeouts
    const keepalive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 30_000);

    // Cleanup on client disconnect
    req.on('close', () => {
      clearInterval(keepalive);
      spawner.off('output', onOutput);
      spawner.off('exit', onExit);
    });
  }

  /** Serve static files from the Studio build directory */
  private handleStatic(urlPath: string, res: ServerResponse): void {
    if (!this.config.staticDir) {
      jsonResponse(res, 404, { error: 'Static serving not configured' });
      return;
    }

    // Default to index.html for SPA routing
    const filePath = urlPath === '/' ? '/index.html' : urlPath;

    // Security: prevent directory traversal
    const normalized = normalize(filePath);
    if (normalized.includes('..')) {
      res.writeHead(400);
      res.end('Bad request');
      return;
    }

    const fullPath = join(this.config.staticDir, normalized);

    // If file doesn't exist, serve index.html (SPA fallback)
    const targetPath =
      existsSync(fullPath) && statSync(fullPath).isFile()
        ? fullPath
        : join(this.config.staticDir, 'index.html');

    if (!existsSync(targetPath)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = extname(targetPath);
    const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    createReadStream(targetPath).pipe(res);
  }

  private logAuth(message: string): void {
    process.stderr.write(`[http-gateway auth] ${message}\n`);
  }
}

/** SHA-256 hex digest of a string. */
function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Helper to send a JSON response */
function jsonResponse(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
  });
  res.end(json);
}
