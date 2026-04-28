/**
 * OG image URL helper. Builds a `https://api.revealui.com/api/og?...` URL
 * for the satori-based renderer in apps/server. Used by per-page route
 * components when they want a custom OG image; the global default lives in
 * `index.html`.
 */

const OG_BASE_URL = `${
  import.meta.env.VITE_API_URL ??
  (import.meta.env.PROD ? 'https://api.revealui.com' : 'http://localhost:3004')
}/api/og`;

export function buildOgUrl(title: string, description?: string): string {
  const params = new URLSearchParams({ title });
  if (description) params.set('description', description);
  return `${OG_BASE_URL}?${params.toString()}`;
}
