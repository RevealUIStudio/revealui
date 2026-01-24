import type { Plugin } from "vite";

interface RevealUIOptions {
	prerender?:
		| boolean
		| {
				partial?: boolean;
				noExtraDir?: boolean;
				parallel?: number;
				disableAutoRun?: boolean;
		  };
}

export default function revealui(options: RevealUIOptions = {}): Plugin {
	// Use revealui internally but expose as revealui
	return revealui(options) as Plugin;
}
