/** Read-only, bounded transport and database diagnostics for the isolated controller. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUEST_TIMEOUT_MS = 5_000;
const MAX_RESPONSE_BYTES = 1_048_576;

type Probe = { ok: boolean; detail: string };
export interface ControllerStatus {
  app: string;
  live: Probe;
  ready: Probe;
  machine: Probe;
  diagnosticsPassed: boolean;
  receiptEvidence: 'unverified';
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

async function readJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('invalid_response');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > MAX_RESPONSE_BYTES) throw new Error('response_too_large');
      chunks.push(next.value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8'));
}

async function getJson(
  url: string,
  token: string | undefined,
  request: typeof fetch,
): Promise<Probe & { data?: unknown }> {
  const abort = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const operation = (async (): Promise<Probe & { data?: unknown }> => {
      try {
        const response = await request(url, {
          method: 'GET',
          headers: {
            accept: 'application/json',
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          redirect: 'error',
          cache: 'no-store',
          signal: abort.signal,
        });
        if (response.status === 401 || response.status === 403)
          return { ok: false, detail: `authentication_rejected_${response.status}` };
        if (!response.ok) return { ok: false, detail: `http_${response.status}` };
        return { ok: true, detail: 'response_ok', data: await readJson(response) };
      } catch {
        return { ok: false, detail: 'request_failed' };
      }
    })();
    const deadline = new Promise<Probe>((resolve) => {
      timer = setTimeout(() => {
        abort.abort();
        resolve({ ok: false, detail: 'timeout' });
      }, REQUEST_TIMEOUT_MS);
    });
    return await Promise.race([operation, deadline]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function collectControllerStatus(input: {
  app: string;
  flyReadToken: string;
  request?: typeof fetch;
}): Promise<ControllerStatus> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.app)) throw new Error('invalid app name');
  if (!input.flyReadToken.trim()) throw new Error('FLY_READONLY_TOKEN is required');
  const request = input.request ?? fetch;
  const base = `https://${input.app}.fly.dev`;
  const [liveResponse, readyResponse, machineResponse] = await Promise.all([
    getJson(`${base}/health/live`, undefined, request),
    getJson(`${base}/health/ready`, undefined, request),
    getJson(`https://api.machines.dev/v1/apps/${input.app}/machines`, input.flyReadToken, request),
  ]);
  const liveBody = object(liveResponse.data);
  const readyBody = object(readyResponse.data);
  const live: Probe =
    liveResponse.ok && liveBody?.ok === true && liveBody.service === 'review-controller'
      ? { ok: true, detail: 'http_live' }
      : { ok: false, detail: liveResponse.ok ? 'invalid_live_response' : liveResponse.detail };
  const ready: Probe =
    readyResponse.ok && readyBody?.ok === true
      ? { ok: true, detail: 'database_ready' }
      : { ok: false, detail: readyResponse.ok ? 'database_unready' : readyResponse.detail };
  let machine: Probe;
  if (!machineResponse.ok) machine = { ok: false, detail: machineResponse.detail };
  else if (!Array.isArray(machineResponse.data))
    machine = { ok: false, detail: 'invalid_machine_response' };
  else if (machineResponse.data.length !== 1)
    machine = { ok: false, detail: `machine_count_${machineResponse.data.length}` };
  else {
    const record = object(machineResponse.data[0]);
    machine =
      record?.state === 'started' && typeof record.id === 'string' && record.id.length > 0
        ? { ok: true, detail: 'one_machine_started' }
        : { ok: false, detail: 'machine_not_started' };
  }
  return {
    app: input.app,
    live,
    ready,
    machine,
    diagnosticsPassed: live.ok && ready.ok && machine.ok,
    receiptEvidence: 'unverified',
  };
}

async function main(): Promise<void> {
  if (process.argv.length !== 2)
    throw new Error('usage: pnpm --filter @revealui/review-controller ops:status');
  const configPath = join(dirname(fileURLToPath(import.meta.url)), '../config/shadow-policy.json');
  const config = object(JSON.parse(readFileSync(configPath, 'utf8')));
  const app = config?.flyApp;
  if (typeof app !== 'string') throw new Error('invalid shadow policy');
  const token = process.env.FLY_READONLY_TOKEN ?? '';
  const status = await collectControllerStatus({ app, flyReadToken: token });
  process.stdout.write(`${JSON.stringify(status)}\n`);
  if (!status.diagnosticsPassed) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error: unknown) => {
    // Never print request errors or token-bearing input, including API response bodies.
    process.stderr.write(`${error instanceof Error ? error.message : 'status probe failed'}\n`);
    process.exitCode = 1;
  });
}
