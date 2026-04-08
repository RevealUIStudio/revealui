import { randomBytes } from 'node:crypto';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { extname, join, normalize } from 'node:path';
import type { RpcServer } from './rpc-server.js';
import type { AgentExitEvent, AgentOutputEvent, SpawnerService } from './spawner-service.js';

/**
 * HTTP gateway that exposes the harness daemon over TCP.
 *
 * Routes:
 *   POST /rpc              — JSON-RPC 2.0 proxy (same protocol as Unix socket)
 *   GET  /api/pair          — Returns pairing status (requires valid token or no token set)
 *   POST /api/pair          — Submit pairing code to get a session token
 *   GET  /api/stream/:id     — SSE stream of agent output (real-time)
 *   GET  /                  — Serves Studio static frontend (index.html)
 *   GET  /assets/*          — Serves static assets
 *
 * Auth:
 *   All /rpc and /api/* requests (except POST /api/pair) require:
 *     Authorization: Bearer <session-token>
 *   The session token is obtained via the pairing flow.
 */

export interface HttpGatewayConfig {
  /** TCP port to listen on (default: 7890) */
  port: number;
  /** Bind address (default: '0.0.0.0' for Tailscale access) */
  host: string;
  /** Path to Studio static build directory (optional — disables static serving if absent) */
  staticDir?: string;
  /** Reference to the Unix-socket RPC server for dispatching */
  rpcDispatch: RpcServer;
  /** Reference to the spawner service (enables SSE streaming) */
  spawner?: SpawnerService;
}

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

export class HttpGateway {
  private server: Server;
  private readonly config: HttpGatewayConfig;

  /** 6-digit pairing code (regenerated on each start) */
  private pairingCode: string;
  /** Active session tokens (bearer tokens granted after pairing) */
  private sessionTokens: Set<string> = new Set();
  /** Whether pairing has been completed at least once */
  private paired = false;

  constructor(config: HttpGatewayConfig) {
    this.config = config;
    this.pairingCode = generatePairingCode();
    this.server = createServer((req, res) => this.handleRequest(req, res));
  }

  /** The current pairing code (display this in Studio/terminal) */
  getPairingCode(): string {
    return this.pairingCode;
  }

  /** Regenerate the pairing code (invalidates previous code) */
  regeneratePairingCode(): string {
    this.pairingCode = generatePairingCode();
    return this.pairingCode;
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

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const path = url.pathname;

    // CORS headers for mobile browser access
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Pairing endpoint — no auth required
    if (path === '/api/pair' && req.method === 'POST') {
      this.handlePair(req, res);
      return;
    }

    // All other API/RPC endpoints require auth
    if (path === '/rpc' || path.startsWith('/api/')) {
      if (!this.checkAuth(req, res)) return;

      if (path === '/rpc' && req.method === 'POST') {
        this.handleRpc(req, res);
        return;
      }

      if (path === '/api/pair' && req.method === 'GET') {
        this.handlePairStatus(res);
        return;
      }

      if (path === '/api/status') {
        this.handleStatus(res);
        return;
      }

      // SSE stream: /api/stream or /api/stream/<sessionId>
      if (path.startsWith('/api/stream') && req.method === 'GET') {
        const sessionFilter = path.split('/')[3] ?? null; // optional session ID filter
        this.handleStream(req, res, sessionFilter);
        return;
      }

      jsonResponse(res, 404, { error: 'Not found' });
      return;
    }

    // Static file serving
    this.handleStatic(path, res);
  }

  /** Verify the Authorization: Bearer <token> header */
  private checkAuth(req: IncomingMessage, res: ServerResponse): boolean {
    // If no tokens have been issued yet, allow unauthenticated access
    // (first-time setup before pairing)
    if (this.sessionTokens.size === 0 && !this.paired) {
      return true;
    }

    const authHeader = req.headers.authorization ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      jsonResponse(res, 401, { error: 'Authorization required', paired: this.paired });
      return false;
    }

    const token = authHeader.slice(7);
    if (!this.sessionTokens.has(token)) {
      jsonResponse(res, 403, { error: 'Invalid token' });
      return false;
    }

    return true;
  }

  /** POST /api/pair — submit pairing code, receive session token */
  private handlePair(req: IncomingMessage, res: ServerResponse): void {
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
      try {
        const { code } = JSON.parse(body) as { code: string };
        if (code !== this.pairingCode) {
          jsonResponse(res, 403, { error: 'Invalid pairing code' });
          return;
        }

        // Issue a session token
        const token = randomBytes(32).toString('hex');
        this.sessionTokens.add(token);
        this.paired = true;

        // Regenerate pairing code so it can't be reused
        this.pairingCode = generatePairingCode();

        jsonResponse(res, 200, { token, expires: null });
      } catch {
        jsonResponse(res, 400, { error: 'Invalid JSON' });
      }
    });
  }

  /** GET /api/pair — check pairing status */
  private handlePairStatus(res: ServerResponse): void {
    jsonResponse(res, 200, {
      paired: this.paired,
      activeSessions: this.sessionTokens.size,
    });
  }

  /** GET /api/status — daemon status summary */
  private handleStatus(res: ServerResponse): void {
    jsonResponse(res, 200, {
      daemon: 'revdev-harness',
      pid: process.pid,
      uptime: process.uptime(),
      paired: this.paired,
      activeSessions: this.sessionTokens.size,
    });
  }

  /** POST /rpc — proxy JSON-RPC to the daemon's dispatch */
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

  /** GET /api/stream[/:sessionId] — SSE for agent output and exit events */
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
      'Access-Control-Allow-Origin': '*',
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
}

/** Generate a 6-digit numeric pairing code */
function generatePairingCode(): string {
  // Use crypto for uniform distribution
  const bytes = randomBytes(4);
  const num = bytes.readUInt32BE(0) % 1_000_000;
  return num.toString().padStart(6, '0');
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
