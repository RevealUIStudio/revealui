/**
 * Security & Compliance  -  full server-side surface.
 *
 * Re-exports the client-safe `@revealui/security` barrel AND the server-only
 * `@revealui/security/server` entry (auth/gdpr/audit/ssrf — node: built-ins),
 * so server code can pull any security symbol from one place. Because it
 * re-exports `./server`, THIS entry is server-only: do not import
 * `@revealui/core/security` from client/RSC code (use `@revealui/security` or
 * `@revealui/security/sanitize` there).
 */
export * from '@revealui/security';
export * from '@revealui/security/server';
