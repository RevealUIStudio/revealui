import { withRevealUI } from '@revealui/core/vite/withRevealUI';
import react from '@vitejs/plugin-react';
import rsc from '@vitejs/plugin-rsc';
import { defineConfig } from 'vite';

/**
 * Dogfood `@revealui/core/vite/withRevealUI` (GAP-194 Tier 0 step 3.0).
 * Perimeter CSP/CSRF still live in `src/request-layer` (2.3.4); this only
 * injects REVEALUI_* define + baseline dev/preview headers.
 */
export default defineConfig(
  withRevealUI(
    {
      plugins: [
        rsc({
          entries: {
            rsc: './src/entry.rsc.tsx',
            ssr: './src/entry.ssr.tsx',
            client: './src/entry.browser.tsx',
          },
        }),
        react(),
      ],
    },
    {
      // Dogfood shell is not the admin product UI; request-layer owns gates.
      admin: false,
      configPath: './revealui.config.ts',
    },
  ),
);
