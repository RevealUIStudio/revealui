import { describe, expect, it, vi } from 'vitest';
import { validatePulledEnv } from '../prod-env';

const apiBootstrap = vi.hoisted(() => vi.fn());
vi.mock('../../../apps/server/src/lib/validate-startup', () => {
  apiBootstrap();
  return {
    validateStartup: () => {
      throw new Error('synthetic API bootstrap unavailable');
    },
  };
});

describe('deployment posture bootstrap boundary', () => {
  it('checks admin posture without importing the API startup graph', async () => {
    expect(await validatePulledEnv({ REVEALUI_DEPLOYMENT_MODE: 'hosted' }, 'admin')).toMatchObject({
      ok: true,
      mode: 'hosted',
    });
    expect(apiBootstrap).not.toHaveBeenCalled();
  });

  it('still requires the full API validator and fails closed if its bootstrap fails', async () => {
    expect(await validatePulledEnv({ REVEALUI_DEPLOYMENT_MODE: 'hosted' }, 'api')).toMatchObject({
      ok: false,
      message: expect.stringContaining('synthetic API bootstrap unavailable'),
    });
    expect(apiBootstrap).toHaveBeenCalledOnce();
  });
});
