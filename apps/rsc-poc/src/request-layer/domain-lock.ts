/**
 * Optional host allowlist (RevForge domain-lock dogfood, 2.3.4).
 * Enabled only when RSC_POC_ALLOWED_HOSTS is set (comma-separated hosts).
 * Lives outside Router.match.
 */

export function domainLockResponse(request: Request): Response | null {
  const raw = process.env.RSC_POC_ALLOWED_HOSTS;
  if (!raw || raw.trim().length === 0) return null;

  const allowed = raw
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter((h) => h.length > 0);
  if (allowed.length === 0) return null;

  const host = new URL(request.url).host.toLowerCase();
  if (allowed.includes(host)) return null;

  return new Response('Forbidden host (domain-lock)', {
    status: 403,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
