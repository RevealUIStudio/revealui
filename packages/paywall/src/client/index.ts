/**
 * @revealui/paywall/client
 *
 * React components for client-side feature gating and upgrade prompts.
 *
 * IMPORTANT: These components are UX-only soft gates. Server-side middleware
 * is the authoritative enforcement layer. Client-side gates improve the user
 * experience by preventing clicks on locked features before the server denies them.
 *
 * Components (Phase 2):
 * - LicenseProvider — React context that fetches tier/features from your API
 * - LicenseGate — Declarative feature gate (inline or dialog mode)
 * - UpgradePrompt — Upgrade CTA with pricing
 * - UpgradeDialog — Global upgrade modal (DOM event driven)
 * - useLicense — Hook: { tier, features, isLoading, refetch }
 *
 * @packageDocumentation
 */

export {};
