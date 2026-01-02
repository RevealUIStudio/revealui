import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import sharedViteConfig from '../../packages/dev/src/vite/vite.shared.js'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

dotenv.config({
  path: path.resolve(dirname, '../../.env.development.local'),
})

export default defineConfig({
  ...sharedViteConfig,
  // plugins: [],
})

// import dotenv from "dotenv";
// import path from "path";
// import { fileURLToPath } from "url";
// import ssr from "reveal/plugin";
// import { defineConfig } from "vite";
// const filename = fileURLToPath(import.meta.url);
// const dirname = path.dirname(filename);

// const viteConfig = defineConfig({
//   server: {
//     port: 4000,
//     proxy: {
//       // '/': {
//       //   target: 'https://admin.streetbeefsscrapyard.com', // RevealUI CMS production URL
//       //   changeOrigin: true,
//       //   rewrite: (path) => path.replace(/^\/admin/, '/admin'),
//       // },
//       // '/admin': {
//       //   target: 'https://admin.streetbeefsscrapyard.com', // RevealUI CMS production URL
//       //   changeOrigin: true,
//       //   rewrite: (path) => path.replace(/^\/admin/, '/admin'),
//       // },
//       "/api": {
//         target: "https://admin.streetbeefsscrapyard.com", // RevealUI CMS production URL
//         changeOrigin: true,
//         rewrite: (path) => path.replace(/^\/api/, "/api"),
//       },
//     },
//   },
//   plugins: [ssr({ prerender: true })],
//   define: {
//     "process.env": process.env,
//     "import.meta.env.REVEALUI_PUBLIC_SERVER_URL": JSON.stringify(
//       process.env.REVEALUI_PUBLIC_SERVER_URL,
//     ),
//   },
//   build: {
//     rollupOptions: {
//       external: [
//         "node:fs",
//         "path",
//         "os",
//         "crypto",
//         "util",
//         "assert",
//         "events",
//         "node:url",
//         "node:resolve",
//         "http",
//         "https",
//         "zlib",
//         "tty",
//         "module",
//         "child_import",
//         "worker_threads",
//         "stream",
//         "import.meta",
//       ],
//     },
//     emptyOutDir: true,
//     ssrManifest: true,
//     outDir: ".next",
//   },
//   resolve: {
//     alias: {
//       "@/*": path.resolve(dirname, "./src/*"),
//       "@reveal-config": path.resolve(dirname, "./revealui.config.ts"),
//       "assets": path.resolve(dirname, "../../packages/assets/src/"),
//       "~components": path.resolve(dirname, "./src/components/"),
//       "reveal": path.resolve(dirname, "../../packages/reveal/src/*"),

//     },
//   },
//   // optimizeDeps: {
//   //   include: ["fs"],
//   // },
// });

// export default viteConfig;
