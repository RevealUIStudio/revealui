import sharedConfig from "../../packages/dev/src/eslint/eslint.config.js";
export default {
  ...sharedConfig,
  ignores: ["dist/", "node_modules/", ".turbo", "public/"],
};
