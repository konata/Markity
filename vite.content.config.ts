import { resolve } from "node:path";
import { defineConfig } from "vite";

const outDir = resolve("dist", process.env.MARKITY_TARGET ?? "chrome");

export default defineConfig({
  publicDir: false,
  build: {
    outDir,
    emptyOutDir: false,
    lib: {
      entry: resolve("src/extension/content.ts"),
      formats: ["iife"],
      name: "MarkityContent",
      fileName: () => "content.js"
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
});
