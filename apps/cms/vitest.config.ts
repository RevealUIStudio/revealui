import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/__tests__/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      exclude: [
        "node_modules/**",
        "src/__tests__/**",
        "**/*.test.ts",
        "**/*.spec.ts",
        "dist/**",
        ".next/**",
      ],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@payload-config": path.resolve(__dirname, "./payload.config.ts"),
      "@/collections": path.resolve(__dirname, "./src/lib/collections"),
      "@/blocks": path.resolve(__dirname, "./src/lib/blocks"),
      "@/components": path.resolve(__dirname, "./src/lib/components"),
      "@/access": path.resolve(__dirname, "./src/lib/access"),
      "@/hooks": path.resolve(__dirname, "./src/lib/hooks"),
      "@/fields": path.resolve(__dirname, "./src/lib/fields"),
      "@/utilities": path.resolve(__dirname, "./src/lib/utilities"),
      "@/globals": path.resolve(__dirname, "./src/lib/globals"),
      "@/heros": path.resolve(__dirname, "./src/lib/heros"),
      "@/lib": path.resolve(__dirname, "./src/lib"),
    },
  },
})

