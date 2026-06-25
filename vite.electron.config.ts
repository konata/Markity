import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  publicDir: false,
  build: {
    outDir: resolve("dist/electron"),
    emptyOutDir: true,
    rollupOptions: {
      input: { index: resolve("electron.html") },
      output: {
        entryFileNames: "renderer.js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name][extname]"
      }
    }
  }
});
