import sharedConfig from "../../packages/dev/src/eslint/eslint.config.js";
export default [
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/.turbo/**", "**/.next/**"],
  },
  {
    ...sharedConfig,
  },
];
