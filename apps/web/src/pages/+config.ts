import Layout from "../layouts/Default"
import revealuiReact from "revealui-react/config"
import type { Config } from "revealui/types"

const config = {
  Layout,
  extends: revealuiReact,
  prerender: {
    partial: false,
    noExtraDir: false,
    parallel: 4,
    disableAutoRun: false
  }
} satisfies Config

export default config

// // https://reveal.dev/config
// export const config = {
//   passToClient: ["routeParams", "pageProps"],
//   //   process.env.NODE_ENV !== "production" && "$$typeof",
//   // ].filter(isNotFalse),
//   clientRouting: true,
//   hydrationCanBeAborted: true,
//   // https://reveal.dev/meta
//   meta: {
//     // Define new setting 'title'
//     title: {
//       env: { server: true, client: true },
//     },
//     stream: {
//       env: { server: true },
//       // effect: ssrEffect,
//     },
//     ssr: {
//       env: { config: true },
//       effect: ssrEffect,
//     },
//     // Define new setting 'dataIsomorph'
//     dataIsomorph: {
//       env: { config: true },
//       effect({ configDefinedAt, configValue }) {
//         if (typeof configValue !== "boolean") {
//           throw new Error(`${configDefinedAt} should be a boolean`);
//         }
//         if (configValue) {
//           return {
//             meta: {
//               preloadStrategy: {
//                 env: { server: true },
//               },
//               data: {
//                 // We override reveal's default behavior of always loading/executing data() on the server-side.
//                 // If we set dataIsomorph to true, then data() is loaded/executed in the browser as well, allowing us to fetch data direcly from the browser upon client-side navigation (without involving our Node.js/Edge server at all).
//                 env: { server: true, client: true },
//               },
//             },
//           };
//         }
//       },
//     },
//     renderMode: {
//       env: { config: true },
//       effect({ configDefinedAt, configValue }) {
//         let env: ConfigEnv | undefined;
//         if (configValue == "HTML") env = { server: true };
//         if (configValue == "SPA") env = { client: true };
//         if (configValue == "SSR") env = { server: true, client: true };
//         if (!env)
//           throw new Error(
//             `${configDefinedAt} should be 'SSR', 'SPA', or 'HTML'`,
//           );
//         return {
//           meta: {
//             Page: { env },
//           },
//         };
//       },
//     },
//   },
//   hooksTimeout: {
//     data: {
//       error: 30 * 1000,
//       warning: 10 * 1000,
//     },
//   },
// } satisfies Config;
// import type { Config, ConfigEnv } from "reveal/types";
// // import { isNotFalse } from "reveal";
// import { ssrEffect } from "./ssrEffect";

// // https://reveal.dev/config
// export const config = {
//   passToClient: ["routeParams", "pageProps"],
//   clientRouting: true,
//   hydrationCanBeAborted: true,
//   // https://reveal.dev/meta
//   meta: {
//     // Define new setting 'title'
//     title: {
//       env: { server: true, client: true },
//     },
//     stream: {
//       env: { server: true, config: true },
//       effect: ssrEffect,
//     },
//     ssr: {
//       env: { config: true },
//       effect: ssrEffect,
//     },
//     // Define new setting 'dataIsomorph'
//     dataIsomorph: {
//       env: { config: true },
//       effect({ configDefinedAt, configValue }) {
//         if (typeof configValue !== "boolean") {
//           throw new Error(`${configDefinedAt} should be a boolean`);
//         }
//         if (configValue) {
//           return {
//             meta: {
//               preloadStrategy: {
//                 env: { server: true },
//               },
//               data: {
//                 env: { server: true, client: true },
//               },
//             },
//           };
//         }
//       },
//     },
//     renderMode: {
//       env: { config: true },
//       effect({ configDefinedAt, configValue }) {
//         let env: ConfigEnv | undefined;
//         if (configValue == "HTML") env = { server: true };
//         if (configValue == "SPA") env = { client: true };
//         if (configValue == "SSR") env = { server: true, client: true };
//         if (!env)
//           throw new Error(
//             `${configDefinedAt} should be 'SSR', 'SPA', or 'HTML'`,
//           );
//         return {
//           meta: {
//             Page: { env },
//           },
//         };
//       },
//     },
//   },
//   hooksTimeout: {
//     data: {
//       error: 30 * 1000,
//       warning: 10 * 1000,
//     },
//   },
// } satisfies Config;
