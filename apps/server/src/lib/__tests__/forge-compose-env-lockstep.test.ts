/**
 * GAP-435 — keep docker-compose.forge.yml locked to the forge boot contract.
 *
 * Pure string checks (no Docker). Fails if retired env names, wrong Postgres
 * image, or missing migrate service reappear.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Resolve from this test file → apps/server/src/lib/__tests__ → repo root
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../../..');

function loadCompose(): string {
  return readFileSync(join(REPO_ROOT, 'docker-compose.forge.yml'), 'utf8');
}

describe('docker-compose.forge.yml lockstep (GAP-435)', () => {
  const text = loadCompose();

  it('does not declare retired license/public-key or JWT/Resend names', () => {
    // These had zero live readers or wrong names vs validate-startup forge mode.
    expect(text).not.toMatch(/REVEALUI_PUBLIC_KEY\s*:/);
    expect(text).not.toMatch(/REVEALUI_PRIVATE_KEY\s*:/);
    expect(text).not.toMatch(/JWT_SECRET\s*:/);
    expect(text).not.toMatch(/RESEND_API_KEY\s*:/);
    expect(text).not.toMatch(/RESEND_FROM_EMAIL\s*:/);
  });

  it('uses current forge license + KEK + audit + CORS names', () => {
    expect(text).toMatch(/REVEALUI_LICENSE_KEY\s*:/);
    expect(text).toMatch(/REVEALUI_LICENSE_PUBLIC_KEY\s*:/);
    expect(text).toMatch(/REVEALUI_KEK\s*:/);
    expect(text).toMatch(/REVEALUI_AUDIT_SIGNING_KEY\s*:/);
    expect(text).toMatch(/CORS_ORIGIN\s*:/);
    expect(text).toMatch(/REVEALUI_PUBLIC_SERVER_URL\s*:/);
    expect(text).toMatch(/NEXT_PUBLIC_SERVER_URL\s*:/);
  });

  it('uses pgvector Postgres image (migration 0000 CREATE EXTENSION vector)', () => {
    expect(text).toMatch(/image:\s*pgvector\/pgvector:pg16/);
    expect(text).not.toMatch(/image:\s*postgres:16-alpine/);
  });

  it('wires a one-shot migrate service before api/admin', () => {
    expect(text).toMatch(/^\s*migrate:\s*$/m);
    expect(text).toMatch(/target:\s*migrate/);
    expect(text).toMatch(/service_completed_successfully/);
  });
});
