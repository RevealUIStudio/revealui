import { homedir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { coldDaemonSessionsDir } from '../session/archive-exit.js';

afterEach(() => vi.unstubAllEnvs());

describe('canonical fleet archive configuration', () => {
  it('uses the REVEALFLEET namespace for both supported archive layouts', () => {
    vi.stubEnv('REVEALFLEET_ARCHIVE', '/tmp/revealfleet/archive');
    expect(coldDaemonSessionsDir()).toBe('/tmp/revealfleet/archive/cold/sessions/daemon');
    vi.stubEnv('REVEALFLEET_ARCHIVE', '/tmp/revealfleet/archive/cold');
    expect(coldDaemonSessionsDir()).toBe('/tmp/revealfleet/archive/cold/sessions/daemon');
  });

  it('uses the canonical default and never accepts an abbreviated namespace', () => {
    vi.stubEnv('REVEALFLEET_ARCHIVE', '');
    vi.stubEnv(['REV', 'FLEET_ARCHIVE'].join(''), '/tmp/other-archive');
    expect(coldDaemonSessionsDir()).toBe(
      join(homedir(), 'revealfleet', 'archive', 'cold', 'sessions', 'daemon'),
    );
  });
});
