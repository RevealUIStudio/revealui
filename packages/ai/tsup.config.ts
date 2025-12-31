import { defineConfig } from 'tsup'

export default defineConfig({
	entry: {
		index: 'src/index.ts',
		primitives: 'src/primitives/index.ts',
		hooks: 'src/hooks/index.ts',
		utils: 'src/utils/index.ts',
		mcp: 'src/mcp/index.ts',
	},
	format: ['esm'],
	dts: true,
	clean: true,
	external: ['react', 'react-dom', 'openai', '@ai-sdk/openai', 'ai'],
	tsconfig: './tsconfig.json',
})
