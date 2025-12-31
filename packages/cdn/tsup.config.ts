// tsup.config.ts
import { defineConfig } from "tsup";
import { existsSync } from "node:fs";
import { rename } from "node:fs/promises";

// Define interfaces for configuration
interface EntryConfig {
  entry: string[];
  external: (string | RegExp | ((id: string) => boolean))[];
  format: ["esm"];
  platform: "node";
  target: "node20";
  dts: boolean;
  clean: boolean;
  minify: boolean;
  splitting: boolean;
  sourcemap: boolean;
  onSuccess: () => Promise<void>;
}

interface FileCheckConfig {
  checkInterval: number;
  maxWaitTime: number;
}

export default defineConfig([
  {
    entry: ["src/index.ts"],
    external: ["fs", "node:fs", "path", "node:path"],
    format: ["esm"],
    platform: "node",
    target: "node20",
    dts: false,
    clean: true,
    minify: false,
    splitting: false,
    sourcemap: false,

    async onSuccess(): Promise<void> {
      const config: FileCheckConfig = {
        checkInterval: 100, // ms
        maxWaitTime: 5000, // 5 seconds timeout
      };

      try {
        const start: number = Date.now();
        while (Date.now() - start < config.maxWaitTime) {
          if (existsSync("./dist/_config.d.ts")) {
            try {
              await rename("./dist/_config.d.ts", "./dist/+config.d.ts");
              break;
            } catch (renameError: unknown) {
              console.warn("Failed to rename file:", renameError);
            }
          }
          await new Promise((resolve) =>
            setTimeout(resolve, config.checkInterval),
          );
        }
      } catch (error: unknown) {
        console.error("Error in onSuccess handler:", error);
      }
    },
  } satisfies EntryConfig,
]);