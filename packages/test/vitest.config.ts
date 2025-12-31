import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      reveal: path.resolve(__dirname, "../reveal/src"),
    },
  },
  test: {
    include: ["**/*.test.ts", "**/*.spec.ts"],
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      exclude: [
        "node_modules/**",
        "**/*.test.ts",
        "**/*.spec.ts",
        "dist/**",
        "**/__tests__/**",
      ],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },
  },
});
