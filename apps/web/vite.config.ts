// import vercel from "reveal/vercel"
// import reveal from "reveal/plugins";
import react from "@vitejs/plugin-react-swc"
import dotenv from "dotenv"
import path from "path"
import revealui from "revealui/plugin"
import { fileURLToPath } from "url"
import { UserConfig, defineConfig } from "vite"
import vercel from "vite-plugin-vercel";
import devServer from "@hono/vite-dev-server";

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

dotenv.config({
  path: path.resolve(dirname, "../../.env.development.local"),
})

export default defineConfig({
  plugins: [
    // React Compiler is enabled via babel-plugin-react-compiler
    // See babel.config.js for configuration
    react({
      // SWC with React Compiler support
      // Note: React Compiler optimizations are applied via Babel plugin
    }),
    vike(),
    vercel({
      source: process.env.NODE_ENV === "production" ? "dist" : "src",
      destination: "default", // Placeholder, replace with actual destination config
      config: {
        routes: [], // Placeholder, replace with actual routes config
        overrides: {}, // Placeholder, replace with actual overrides config

      }, // Placeholder, replace with actual config
      isr: {}, // Placeholder, replace with actual ISR settings
      edge: [], // Placeholder, replace with actual edge settings
      headers: [], // Placeholder, replace with actual headers settings
      rewrites: [], // Placeholder, replace with actual rewrites
      cleanUrls: true, // Example setting, adjust as needed
      trailingSlash: false, // Example setting, adjust as needed
      additionalEndpoints: [], // Placeholder, replace with actual additional endpoints
      cache: {} // Placeholder, adjust cache settings as needed
    }),
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
    //     target: "https://admin.streetbeefsscrapyard.com",
    //     changeOrigin: true,
    //     rewrite: (path) => path.replace(/^\/api/, "/api"),
    //   },
    // },
  },
  vercel: {
    additionalEndpoints: [
      {
        // entry file to the server. Default export must be a node server or a function
        source: "src/hono-entry.ts",
        // replaces default RevealUI target
        destination: "ssr_",
        // already added by default RevealUI route
        route: false,
      },
    ],
  },

  build: {
    sourcemap: true,
  },
}) satisfies UserConfig

// dotenv.config({
//   path: path.resolve(dirname, "../../.env.development.local"),
// });

// const viteConfig = () => {
//   return defineConfig({
//     // base: "/",
//     ssr: {
//       noExternal: [
//         "@payloadcms/richtext-lexical",
//         "sharp",
//         "@payloadcms/ui",
//         "react-animate-height",
//       ],
//     },
//     plugins: [
//       react(),
//       ssr({ prerender: true }),
//       vercel({
//         source: process.env.NODE_ENV === "production" ? "dist" : "src",
//       }),
//     ],

//     build: {
//       sourcemap: true,
//       rollupOptions: {
//         external: [
//           "node:os",
//           "node:path",
//           "node:fs",
//           "path",
//           "os",
//           "crypto",
//           "util",
//           "assert",
//           "events",
//           "node:url",
//           "resolve",
//           "http",
//           "https",
//           "zlib",
//           "tty",
//           "module",
//           "child_process",
//           "worker_threads",
//           "stream",
//           "node:process",
//           "@payload-config",
//         ],
//       },
//       emptyOutDir: true,
//       ssrManifest: true,
//       outDir: "dist",
//     },
//     resolve: {
//       alias: {
//         "@payload-config": path.resolve(dirname, "../cms/payload.config.ts"),
//         "reveal": path.resolve(dirname, "../../packages/reveal/src"),
//         "reveal/core": path.resolve(dirname, "../../packages/reveal/src/core"),
//         "reveal/ui": path.resolve(dirname, "../../packages/reveal/src/ui"),
//         tsconfig: path.resolve(dirname, "../../tsconfig.json"),
//       },
//     },
//     define: {
//       "process.env": process.env,
//       "import.meta.env.PAYLOAD_PUBLIC_SERVER_URL": JSON.stringify(
//         process.env.PAYLOAD_PUBLIC_SERVER_URL,
//       ),
//       // "import.meta.env.REVALIDATION_KEY": JSON.stringify(
//       //   process.env.REVALIDATION_KEY,
//       // ),
//       // "import.meta.env.API_URL": JSON.stringify(API_URL),
//       // "import.meta.env.REVALIDATION_KEY": JSON.stringify(REVALIDATION_KEY),
//     },
//   });
// };

// export default viteConfig;
