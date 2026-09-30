import { readFileSync } from 'node:fs';
import { Server, Socket } from 'node:net';
import { afterEach, expect, it, vi } from 'vitest';

const { telemetry } = vi.hoisted(() => ({
  telemetry: vi.fn(() => {
    throw new Error('Schema assembly initialized telemetry');
  }),
}));
vi.mock('@sentry/node', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sentry/node')>()),
  init: telemetry,
}));

// Synthetic import diagnostics: schema generation must not boot the server,
// contact an authority/database, initialize telemetry, or start monitors.
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

it('assembles current API contracts without runtime startup or external I/O', async () => {
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('VITEST', '');
  const forbidden = () => {
    throw new Error('Schema assembly attempted runtime I/O');
  };
  const listen = vi.spyOn(Server.prototype, 'listen').mockImplementation(forbidden);
  const connect = vi.spyOn(Socket.prototype, 'connect').mockImplementation(forbidden);
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(forbidden);
  const interval = vi.spyOn(globalThis, 'setInterval').mockImplementation(forbidden);
  const listeners = vi.spyOn(process, 'on');
  const { default: app, openApiConfiguration } = await import('../app.js');
  const spec = app.getOpenAPIDocument(openApiConfiguration);
  const snapshot = JSON.parse(
    readFileSync(new URL('../../../../examples/api/openapi.json', import.meta.url), 'utf8'),
  );

  expect(listen).not.toHaveBeenCalled();
  expect(connect).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
  expect(interval).not.toHaveBeenCalled();
  expect(telemetry).not.toHaveBeenCalled();
  expect(
    listeners.mock.calls.filter(([event]) =>
      ['uncaughtException', 'unhandledRejection', 'SIGTERM', 'SIGINT'].includes(String(event)),
    ),
  ).toEqual([]);
  // Compare the complete registry, not a license-only overlay or copied schema.
  expect(snapshot.paths).toEqual(spec.paths);
  expect(snapshot.components).toEqual(spec.components);
  for (const prefix of ['/api/license', '/api/v1/license']) {
    const generate = spec.paths?.[`${prefix}/generate`]?.post;
    const body = generate?.requestBody as {
      content: { 'application/json': { schema: { required: string[]; properties: object } } };
    };
    expect(body.content['application/json'].schema.required).toContain('operationId');
    expect(body.content['application/json'].schema.properties).toHaveProperty('perpetual');
    expect(body.content['application/json'].schema.properties).toHaveProperty(
      'expectedCurrentLicenseKey',
    );
    expect(generate?.responses).toHaveProperty('503');
    expect(spec.paths?.[`${prefix}/verify`]?.post).toBeDefined();
  }
});
