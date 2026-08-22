/**
 * Same-origin billing proxy: host-only revealui-session never reaches
 * api.staging. The admin rewrite forwards Cookie, matching /a2a.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const nextConfigPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../next.config.mjs',
);

function rewriteDestination(apiPath: string): string {
  return ['destination: `', '$', '{apiUrl}', apiPath, '`'].join('');
}

describe('admin billing proxy rewrites', () => {
  const nextConfig = readFileSync(nextConfigPath, 'utf8');

  it('rewrites credentialed billing subscription through the admin origin', () => {
    expect(nextConfig.includes("source: '/api/billing/subscription'")).toBe(true);
    expect(nextConfig.includes(rewriteDestination('/api/billing/subscription'))).toBe(true);
  });

  it('rewrites perpetual checkout through the admin origin', () => {
    expect(nextConfig.includes("source: '/api/billing/checkout-perpetual'")).toBe(true);
    expect(nextConfig.includes(rewriteDestination('/api/billing/checkout-perpetual'))).toBe(true);
  });
});
