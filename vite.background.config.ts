import { resolve } from "node:path";
import { defineConfig } from "vite";

const outDir = resolve("dist", process.env.MARKITY_TARGET ?? "chrome");

export default defineConfig({
  publicDir: false,
  build: {
    outDir,
    emptyOutDir: false,
    lib: {
      entry: resolve("src/extension/background.ts"),
      formats: ["iife"],
      name: "MarkityBackground",
      fileName: () => "background.js"
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
});
