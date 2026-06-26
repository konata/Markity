import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  publicDir: false,
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  build: {
    outDir: resolve("dist/tauri"),
    emptyOutDir: true,
    rollupOptions: {
      input: { index: resolve("index.html") },
      output: {
        entryFileNames: "renderer.js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name][extname]"
      }
    }
  }
});
