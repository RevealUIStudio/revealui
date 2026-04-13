// RevealUI Next.js runtime integration.
//
// This barrel is intentionally runtime-only. `withRevealUI` is NOT re-exported
// here because it pulls in `node:fs` + `node:path` at module load, which Next's
// NFT tracer then attributes to every route that transitively imports this
// barrel (even via type-only paths). Config-time consumers should import it
// directly from `@revealui/core/nextjs/withRevealUI`.

export { getRevealUI } from './utilities.js';
export type { WithRevealUIOptions } from './withRevealUI.js';
