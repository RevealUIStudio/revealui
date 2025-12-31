import react from "@vitejs/plugin-react-swc";
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig, loadEnv } from "vite";
import sharedViteConfig from "../../packages/dev/src/vite/vite.shared.js";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const { VITE_API_URL, VITE_REVALIDATION_KEY } = loadEnv("", dirname);
const API_URL = VITE_API_URL || process.env.API_URL;
const REVALIDATION_KEY = VITE_REVALIDATION_KEY || process.env.REVALIDATION_KEY;

const viteConfig = defineConfig({
  ...sharedViteConfig,
  plugins: [react()],
  ssr: {
    noExternal: [
      "@payloadcms/richtext-lexical",
      "sharp",
      "@payloadcms/ui",
      " react-animate-height",
    ],
  },
  esbuild: {
    sourcemap: true, // Enable sourcemaps for esbuild
  },
  build: {
    sourcemap: true, // Enable sourcemaps for production builds
    rollupOptions: {
      input: "./index.html",
      external: [
        "fs",
        "react/jsx-runtime",
        "node:fs",
        "path",
        "os",
        "crypto",
        "util",
        "assert",
        "events",
        "node:url",
        "resolve",
        "http",
        "https",
        "zlib",
        "tty",
        "module",
        "child_process",
        "worker_threads",
        "stream",
        "import.meta",
        "process",
      ],
    },
    emptyOutDir: true,
    ssrManifest: true,
    outDir: "dist",
  },
  resolve: {
    alias: {
      "@": path.resolve(dirname, "src"),
      "@payload-config": path.resolve(
        dirname,
        "../../apps/cms/payload.config.ts",
      ),
      "dev/tailwind": path.resolve(
        dirname,
        "../../packages/dev/src/tailwind/tailwind.config.js",
      ),
    },
  },
  define: {
    "import.meta.env.VITE_API_URL": JSON.stringify(process.env.API_URL),
    "import.meta.env.VITE_REVALIDATION_KEY": JSON.stringify(
      process.env.REVALIDATION_KEY,
    ),
    "import.meta.env.API_URL": JSON.stringify(API_URL),
    "import.meta.env.REVALIDATION_KEY": JSON.stringify(REVALIDATION_KEY),
  },
});

export default viteConfig;
