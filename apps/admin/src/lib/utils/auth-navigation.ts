/**
 * Full-document navigation for auth-state transitions (sign-in, sign-up,
 * MFA verify, password rotation).
 *
 * After the session cookie changes, a soft `router.push` replays the App
 * Router client cache, which still holds RSC payloads rendered under the
 * previous auth state — '/' cached as a redirect-to-/login before sign-in
 * bounces the user straight back to /login. A document load re-renders
 * every segment under the new cookie. Sign-out already navigates this way
 * (`useSignOut`, core's SignOutButton); auth entry points must match.
 */
export function navigateAfterAuthChange(path: string): void {
  window.location.href = path;
}
