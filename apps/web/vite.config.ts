import react from "@vitejs/plugin-react-swc"
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import { defineConfig } from "vite"
import devServer from "@hono/vite-dev-server"

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

dotenv.config({
  path: path.resolve(dirname, "../../.env.development.local"),
})

export default defineConfig({
  plugins: [
    react(),
    devServer({
      entry: "src/hono-entry.ts",
      exclude: [
        /^\/@.+$/,
        /.*\.(ts|tsx|vue)($|\?)/,
        /.*\.(s?css|less)($|\?)/,
        /^\/favicon\.ico$/,
        /.*\.(svg|png)($|\?)/,
        /^\/(public|assets|static)\/.+/,
        /^\/node_modules\/.*/,
      ],
      injectClientScript: false,
    }),
  ],
  server: {
    port: 3000,
  },
  build: {
    sourcemap: true,
    ssr: true,
    outDir: "dist",
    rollupOptions: {
      input: "src/hono-entry.ts",
      output: {
        entryFileNames: "[name].js",
      },
    },
  },
})
