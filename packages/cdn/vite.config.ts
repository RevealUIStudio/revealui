import { defineConfig } from "vite";

export default defineConfig({
  plugins: [],
  build: {
    rollupOptions: {
      external: ["fs"],
      input: "src/index.html",
    },
    emptyOutDir: true,
    ssrManifest: true,
    outDir: "./dist",
  },
  // server: {
  //   open: true,
  // },
  assetsInclude: ["**/*.ttf", "**/*.mp3", "**/*.mp4"],
});
