/**
 * @revealui/paywall/client
 *
 * React components for client-side feature gating and upgrade prompts.
 *
 * IMPORTANT: These components are UX-only soft gates. Server-side middleware
 * is the authoritative enforcement layer. Client-side gates improve the user
 * experience by preventing clicks on locked features before the server denies them.
 *
 * @example
 * ```tsx
 * import { createPaywall } from '@revealui/paywall';
 * import { PaywallProvider, usePaywall, PaywallGate } from '@revealui/paywall/client';
 *
 * const paywall = createPaywall();
 *
 * function App() {
 *   return (
 *     <PaywallProvider
 *       paywall={paywall}
 *       resolveTier={async () => {
 *         const res = await fetch('/api/billing/subscription');
 *         const data = await res.json();
 *         return data.tier;
 *       }}
 *     >
 *       <Dashboard />
 *     </PaywallProvider>
 *   );
 * }
 *
 * function Dashboard() {
 *   return (
 *     <PaywallGate
 *       feature="ai"
 *       fallback={<UpgradeCard feature="ai" />}
 *     >
 *       <AIPanel />
 *     </PaywallGate>
 *   );
 * }
 * ```
 *
 * @packageDocumentation
 */

export { PaywallGate, type PaywallGateProps } from './PaywallGate.js';
export {
  type PaywallContextValue,
  PaywallProvider,
  type PaywallProviderProps,
  usePaywall,
} from './PaywallProvider.js';
export {
  dispatchUpgradeEvent,
  UPGRADE_EVENT_NAME,
  type UpgradeEventDetail,
  upgradeAwareFetch,
} from './upgrade-aware-fetch.js';
