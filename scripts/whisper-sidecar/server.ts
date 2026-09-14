#!/usr/bin/env tsx

/**
 * Studio dogfood sidecar for admin `/chat` PTT + attach.
 * Owns http://127.0.0.1:8178 — same ports a future Tauri shell can take.
 * Not a public SKU. Hosted .com still cannot read OS paths; this process can.
 */

import { randomBytes } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8178;
const DEFAULT_UPSTREAM = 'http://127.0.0.1:8179/v1/audio/transcriptions';
const DEFAULT_FILES_DIR = join(homedir(), '.revealui', 'whisper-sidecar', 'files');

interface SidecarConfig {
  host: string;
  port: number;
  upstream: string;
  filesDir: string;
}

interface StoredFile {
  id: string;
  name: string;
  mime: string;
  href: string;
}

function readConfig(env: NodeJS.ProcessEnv = process.env): SidecarConfig {
  const portRaw = env.WHISPER_SIDECAR_PORT?.trim();
  const port = portRaw ? Number(portRaw) : DEFAULT_PORT;
  return {
    host: env.WHISPER_SIDECAR_HOST?.trim() || DEFAULT_HOST,
    port: Number.isFinite(port) && port > 0 ? port : DEFAULT_PORT,
    upstream: env.WHISPER_UPSTREAM?.trim() || DEFAULT_UPSTREAM,
    filesDir: expandHome(env.WHISPER_SIDECAR_FILES_DIR?.trim() || DEFAULT_FILES_DIR),
  };
}

function expandHome(value: string): string {
  if (value.startsWith('~/')) return join(homedir(), value.slice(2));
  return value;
}

function cors(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  cors(res);
  const json = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(json);
}

function safeFileName(name: string): string {
  let start = 0;
  for (let i = 0; i < name.length; i++) {
    const ch = name[i];
    if (ch === '/' || ch === '\\') start = i + 1;
  }
  let out = '';
  for (const ch of name.slice(start).trim()) {
    const code = ch.charCodeAt(0);
    if (code >= 32 && ch !== '[' && ch !== ']') out += ch;
  }
  return out.slice(0, 200) || 'attach.bin';
}

function isSafeId(id: string): boolean {
  if (id.length === 0 || id.length > 64) return false;
  if (id.includes('/') || id.includes('\\') || id.includes('..')) return false;
  for (const ch of id) {
    const ok = (ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f') || (ch >= 'A' && ch <= 'F');
    if (!ok) return false;
  }
  return true;
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function requestFormData(req: IncomingMessage, pathname: string): Promise<FormData> {
  const body = await readBody(req);
  const headers = new Headers();
  const contentType = req.headers['content-type'];
  if (typeof contentType === 'string') headers.set('content-type', contentType);
  const webReq = new Request(`http://127.0.0.1${pathname}`, {
    method: 'POST',
    headers,
    body,
  });
  return webReq.formData();
}

async function listFiles(filesDir: string): Promise<StoredFile[]> {
  await mkdir(filesDir, { recursive: true });
  const names = await readdir(filesDir);
  const files: StoredFile[] = [];
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    const id = name.slice(0, -'.json'.length);
    if (!isSafeId(id)) continue;
    const raw = JSON.parse(await readFile(join(filesDir, name), 'utf8')) as unknown;
    if (!raw || typeof raw !== 'object') continue;
    const rec = raw as Record<string, unknown>;
    if (typeof rec.name !== 'string') continue;
    files.push({
      id,
      name: rec.name,
      mime: typeof rec.mime === 'string' ? rec.mime : 'application/octet-stream',
      href: `/files/${id}`,
    });
  }
  return files;
}

async function storeFile(filesDir: string, file: File): Promise<StoredFile> {
  await mkdir(filesDir, { recursive: true });
  const id = randomBytes(16).toString('hex');
  const name = safeFileName(file.name);
  const mime = file.type || 'application/octet-stream';
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(join(filesDir, `${id}.bin`), bytes);
  await writeFile(join(filesDir, `${id}.json`), JSON.stringify({ name, mime }));
  return { id, name, mime, href: `/files/${id}` };
}

async function handleTranscribe(
  req: IncomingMessage,
  res: ServerResponse,
  cfg: SidecarConfig,
): Promise<void> {
  const body = await readBody(req);
  const headers = new Headers();
  const contentType = req.headers['content-type'];
  if (typeof contentType === 'string') headers.set('content-type', contentType);
  let upstream: Response;
  try {
    upstream = await fetch(cfg.upstream, { method: 'POST', headers, body });
  } catch {
    sendJson(res, 503, {
      error:
        'Whisper upstream is not reachable. Start whisper-server on 8179 or set WHISPER_UPSTREAM.',
    });
    return;
  }
  const text = await upstream.text();
  cors(res);
  res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
  res.end(text);
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  cfg: SidecarConfig,
): Promise<void> {
  const method = req.method ?? 'GET';
  const url = new URL(req.url ?? '/', `http://${cfg.host}:${cfg.port}`);
  const pathname = url.pathname;

  if (method === 'OPTIONS') {
    cors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (method === 'GET' && pathname === '/health') {
    sendJson(res, 200, { ok: true, transcribe: '/transcribe', files: '/files' });
    return;
  }

  if (method === 'POST' && pathname === '/transcribe') {
    await handleTranscribe(req, res, cfg);
    return;
  }

  if (method === 'GET' && pathname === '/files') {
    sendJson(res, 200, { files: await listFiles(cfg.filesDir) });
    return;
  }

  if (method === 'POST' && pathname === '/files') {
    const form = await requestFormData(req, pathname);
    const value = form.get('file');
    if (!(value instanceof File)) {
      sendJson(res, 400, { error: 'Expected multipart field "file".' });
      return;
    }
    sendJson(res, 200, await storeFile(cfg.filesDir, value));
    return;
  }

  sendJson(res, 404, { error: 'Not found. Use POST /transcribe or GET|POST /files.' });
}

const cfg = readConfig();
const server = createServer((req, res) => {
  void handle(req, res, cfg).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'sidecar error';
    if (!res.headersSent) sendJson(res, 500, { error: message });
    else res.end();
  });
});

server.listen(cfg.port, cfg.host, () => {
  console.log(`whisper sidecar listening on http://${cfg.host}:${cfg.port}`);
  console.log(`  POST /transcribe  → ${cfg.upstream}`);
  console.log(`  GET|POST /files   → ${cfg.filesDir}`);
});
