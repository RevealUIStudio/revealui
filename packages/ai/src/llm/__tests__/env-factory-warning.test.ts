/**
 * GAP-360 PR-1 §5.3 — the zero-config localhost-default boot warning.
 *
 * The docstring at client.ts promised a one-line stderr warning when the
 * zero-config inference-snaps localhost default is selected, but nothing emitted
 * it. This asserts it now fires — exactly once per process (module-level guard),
 * only on the zero-config path.
 *
 * Isolated in its own file so the module-level once-guard starts fresh.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { warnSpy } = vi.hoisted(() => ({ warnSpy: vi.fn() }));

vi.mock('@revealui/core/observability/logger', () => ({
  createLogger: () => ({
    warn: warnSpy,
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { createLLMClientFromEnv } from '../client.js';

// The supported profile storage boundary keeps provider tests independent of host profiles.
const fixtureDir = mkdtempSync(join(tmpdir(), 'llm-factory-'));
const fixtureProfilePath = join(fixtureDir, 'inference-profile.json');
afterAll(() => rmSync(fixtureDir, { recursive: true, force: true }));

let factoryEnv: NodeJS.ProcessEnv;
beforeEach(() => {
  factoryEnv = {};
});

describe('zero-config localhost default warning', () => {
  it('emits exactly once across repeated zero-config factory calls', () => {
    createLLMClientFromEnv({ profilePath: fixtureProfilePath, env: factoryEnv });
    createLLMClientFromEnv({ profilePath: fixtureProfilePath, env: factoryEnv });
    createLLMClientFromEnv({ profilePath: fixtureProfilePath, env: factoryEnv });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('inference-snaps');
  });
});
