import { generateKeyPairSync } from 'node:crypto';
import { Hono } from 'hono';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/db', () => ({
  getClient: vi.fn(),
  getPoolMetrics: vi.fn().mockReturnValue([]),
}));

import { getClient } from '@revealui/db';
import {
  generateLicenseKey,
  getLicenseStatus,
  initializeLicense,
  resetLicenseState,
} from '@revealui/core/license';
import { setCorsConfigMissing, setLicenseCanaryDegraded } from '../../lib/startup-state.js';
import healthApp from '../health.js';

const mockedGetClient = vi.mocked(getClient);

function createApp() {
  const app = new Hono();
  app.route('/', healthApp);
  return app;
}

// biome-ignore lint/suspicious/noExplicitAny: test helper — response shape varies per endpoint
async function parseBody(res: Response): Promise<any> {
  return res.json();
}

let publicKeyPem: string;
let privateKeyPem: string;

beforeAll(() => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  publicKeyPem = publicKey;
  privateKeyPem = privateKey;
});

beforeEach(() => {
  process.env.POSTGRES_URL = 'postgres://localhost/test';
  process.env.NODE_ENV = 'test';
  const mockDb = { execute: vi.fn().mockResolvedValue([{ '?column?': 1 }]) };
  mockedGetClient.mockReturnValue(mockDb as never);
});

afterEach(() => {
  resetLicenseState();
  setLicenseCanaryDegraded(false);
  setCorsConfigMissing(false);
  delete process.env.REVEALUI_LICENSE_KEY;
  delete process.env.REVEALUI_LICENSE_PUBLIC_KEY;
  delete process.env.REVEALUI_LICENSE_PUBLIC_KEY_NEXT;
  vi.clearAllMocks();
});

describe('GET /ready — license readiness surface', () => {
  it('returns 200 with no license configured and DB healthy', async () => {
    const app = createApp();
    const res = await app.request('/ready');
    expect(res.status).toBe(200);
  });

  it('returns 503 when a license key is present but expired beyond the grace period', async () => {
    const expiredToken = await generateLicenseKey(
      { tier: 'pro', customerId: 'cus_x' },
      privateKeyPem,
      -(4 * 24 * 60 * 60),
      publicKeyPem,
    );
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = publicKeyPem;
    process.env.REVEALUI_LICENSE_KEY = expiredToken;
    const tier = await initializeLicense();
    expect(tier).toBe('free');
    expect(getLicenseStatus().mode).toBe('expired');

    const app = createApp();
    const res = await app.request('/ready');
    expect(res.status).toBe(503);
  });

  it('returns 503 with canary fields when licenseCanaryDegraded is set', async () => {
    setLicenseCanaryDegraded(true, 'boom');

    const app = createApp();
    const res = await app.request('/ready');
    expect(res.status).toBe(503);
    const body = await parseBody(res);
    expect(body.licenseCanaryDegraded).toBe(true);
    expect(body.licenseCanaryReason).toBe('boom');
  });

  it('returns 200 after clearing the licenseCanaryDegraded flag', async () => {
    setLicenseCanaryDegraded(true, 'transient');
    setLicenseCanaryDegraded(false);

    const app = createApp();
    const res = await app.request('/ready');
    expect(res.status).toBe(200);
  });
});
