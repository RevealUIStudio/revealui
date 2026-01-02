import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      // Point to actual revealui package
      "@revealui/cms": path.resolve(__dirname, "../revealui/src/cms"),
    },
  },
  test: {
    // Exclude E2E tests (run separately with Playwright)
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    exclude: ["**/e2e/**", "**/node_modules/**"],
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
        "**/e2e/**",
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
