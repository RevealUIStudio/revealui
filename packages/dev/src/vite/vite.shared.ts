// packages/dev/src/vite/vite.shared.ts
// Shared Vite configuration for RevealUI apps
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Calculate paths relative to this file's location (packages/dev/src/vite/)
const packagesRoot = path.resolve(__dirname, "../../.."); // packages/
const projectRoot = path.resolve(__dirname, "../../../.."); // RevealUI/

const sharedViteConfig = {
  esbuild: {
    sourcemap: true,
  },
  ssr: {
    noExternal: ["revealui", "sharp", "react-animate-height"],
  },
  build: {
    target: "esnext",
    sourcemap: true,
    emptyOutDir: true,
    ssrManifest: true,
    outDir: "./dist",
    rollupOptions: {
      external: [
        "fs",
        "node:fs",
        "path",
        "os",
        "crypto",
        "util",
        "assert",
        "events",
        "url",
        "resolve",
        "http",
        "https",
        "zlib",
        "tty",
        "module",
        "child_process",
        "worker_threads",
        "stream",
        "process",
      ],
    },
  },
  resolve: {
    alias: {
      "node:fs": "fs",
      // CMS config alias
      "@reveal-config": path.resolve(projectRoot, "apps/cms/revealui.config.ts"),
      // Package aliases
      "@revealui/cms": path.resolve(packagesRoot, "revealui/src"),
      "@revealui/schema": path.resolve(packagesRoot, "schema/src"),
      "@revealui/db": path.resolve(packagesRoot, "db/src"),
      "@revealui/memory": path.resolve(packagesRoot, "memory/src"),
    },
  },
  define: {
    "import.meta.env.REVEALUI_PUBLIC_SERVER_URL": JSON.stringify(
      process.env.REVEALUI_PUBLIC_SERVER_URL ?? "",
    ),
  },
  optimizeDeps: {
    exclude: [],
  },
};

export default sharedViteConfig;
