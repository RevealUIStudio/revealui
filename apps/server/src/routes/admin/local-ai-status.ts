/**
 * Admin Local AI host status (self-host / Forge only).
 *
 * Read-only surface for the operator profile written by
 * `InferenceService.profileApply` / Studio / `revealui-local-ai`.
 * Never mutates engines. Returns 404 on hosted SaaS.
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { isHostedDeployment } from '@revealui/core/deployment-mode';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { HTTPException } from 'hono/http-exception';
import { isAdminRole } from '../../lib/access.js';

type AdminVariables = {
  user?: { id: string; role: string };
};

function requireAdmin(user: { id: string; role: string } | undefined): void {
  if (!user) throw new HTTPException(401, { message: 'Authentication required' });
  if (!isAdminRole(user.role)) {
    throw new HTTPException(403, { message: 'Admin access required' });
  }
}

function profilePath(): string {
  return (
    process.env.REVEALUI_INFERENCE_PROFILE_PATH ??
    join(homedir(), '.local', 'share', 'revealui', 'inference-profile.json')
  );
}

function activeEnvPath(): string {
  return join(homedir(), '.config', 'revealui', 'local-ai.active.env');
}

function readMemAvailableGiB(): number | null {
  try {
    const text = readFileSync('/proc/meminfo', 'utf8');
    const line = text.split('\n').find((l) => l.startsWith('MemAvailable:'));
    if (!line) return null;
    const kb = Number.parseInt(line.replace(/\D+/g, ''), 10);
    if (!Number.isFinite(kb)) return null;
    return Math.round((kb / 1024 / 1024) * 10) / 10;
  } catch {
    return null;
  }
}

function loadProfile(): Record<string, unknown> | null {
  try {
    const path = profilePath();
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const ProfileShape = z.object({
  available: z.literal(true),
  hosted: z.literal(false),
  profilePath: z.string(),
  activeEnvPath: z.string(),
  profileExists: z.boolean(),
  tier: z.string().nullable(),
  provider: z.string().nullable(),
  model: z.string().nullable(),
  baseURL: z.string().nullable(),
  note: z.string().nullable(),
  updatedAt: z.string().nullable(),
  memAvailableGiB: z.number().nullable(),
  ollamaModelsDir: z.string().nullable(),
});

const UnavailableShape = z.object({
  available: z.literal(false),
  hosted: z.literal(true),
  reason: z.string(),
});

const app = new OpenAPIHono<{ Variables: AdminVariables }>();

app.openapi(
  createRoute({
    method: 'get',
    path: '/',
    tags: ['admin', 'local-ai'],
    summary: 'Host local AI profile status (self-host only)',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.literal(true),
              data: z.union([ProfileShape, UnavailableShape]),
            }),
          },
        },
        description: 'Profile snapshot or hosted unavailable',
      },
      404: {
        description: 'Hosted deployments do not expose host local AI status',
      },
    },
  }),
  async (c) => {
    requireAdmin(c.get('user'));

    if (isHostedDeployment(process.env)) {
      // Soft unavailable payload so Admin can render a clear empty state
      // without treating it as an auth error. Prefer 200 + available:false.
      return c.json({
        success: true as const,
        data: {
          available: false as const,
          hosted: true as const,
          reason:
            'Local AI host status is for self-hosted (Forge) deployments. Use Studio or revealui-harnesses on the host.',
        },
      });
    }

    const profile = loadProfile();
    const str = (key: string): string | null => {
      const v = profile?.[key];
      return typeof v === 'string' ? v : null;
    };

    return c.json({
      success: true as const,
      data: {
        available: true as const,
        hosted: false as const,
        profilePath: profilePath(),
        activeEnvPath: activeEnvPath(),
        profileExists: profile !== null,
        tier: str('tier'),
        provider: str('provider'),
        model: str('model'),
        baseURL: str('baseURL'),
        note: str('note'),
        updatedAt: str('updatedAt'),
        memAvailableGiB: readMemAvailableGiB(),
        ollamaModelsDir: str('ollamaModelsDir'),
      },
    });
  },
);

export default app;
