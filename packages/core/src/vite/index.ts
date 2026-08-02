// RevealUI Vite integration barrel.
//
// `withRevealUI` is re-exported here for convenience. Config-time consumers
// may also import from `@revealui/core/vite/withRevealUI` directly (mirrors
// the Next.js subpath that stays out of runtime NFT graphs).

export {
  type ViteUserConfig,
  type WithRevealUIOptions,
  withRevealUI,
} from './withRevealUI.js';
