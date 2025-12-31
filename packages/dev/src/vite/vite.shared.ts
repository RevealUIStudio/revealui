// packages/dev/vite.shared.js
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

dotenv.config({
  path:
    process.env.NODE_ENV === "production"
      ? path.resolve(process.cwd(), ".env.production.local")
      : path.resolve(process.cwd(), ".env.development.local"),
});

const sharedViteConfig = {
  esbuild: {
    sourcemap: true,
  },
  ssr: {
    noExternal: [
      "@payloadcms/richtext-lexical",
      "sharp",
      "@payloadcms/ui",
      "react-animate-height",
      "reveal",
    ],
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
        "import.meta",
        "process",
      ],
    },
  },
  resolve: {
    alias: {
      "node:fs": "fs",
      "@payload-config": path.resolve(dirname, "../cms/payload.config.ts"),
      reveal: path.resolve(dirname, "../../packages/reveal/src"),
      "reveal/core": path.resolve(
        dirname,
        "../../../../packages/reveal/src/core",
      ),
      "reveal/ui": path.resolve(dirname, "../../../../packages/reveal/src/ui"),
      "reveal/data": path.resolve(
        dirname,
        "../../../../packages/reveal/src/data",
      ),
      "reveal/config": path.resolve(
        dirname,
        "../../../../packages/reveal/src/+config.ts",
      ),
      "reveal/app": path.resolve(
        dirname,
        "../../../../packages/reveal/src/integration/app.tsx",
      ),
      "config/vite": path.resolve(
        dirname,
        "../../packages/dev/src/vite/vite.shared.ts",
      ),
      "config/tailwind": path.resolve(
        dirname,
        "../../packages/dev/src/tailwind/index.ts",
      ),
    },
  },
  define: {
    "process.env": process.env,
    "import.meta.env.PAYLOAD_PUBLIC_SERVER_URL": JSON.stringify(
      process.env.PAYLOAD_PUBLIC_SERVER_URL,
    ),
  },
  optimizeDeps: {
    exclude: [], // Exclude the problematic module
  },
};

export default sharedViteConfig;
