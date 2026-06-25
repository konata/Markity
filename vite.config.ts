import { resolve } from "node:path";
import { defineConfig } from "vite";

const outDir = resolve("dist", process.env.MARKITY_TARGET ?? "chrome");

export default defineConfig({
  publicDir: false,
  build: {
    outDir,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve("popup.html")
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name][extname]"
      }
    }
  }
});
