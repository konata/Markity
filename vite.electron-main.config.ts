import { builtinModules } from "node:module";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const external = ["electron", ...builtinModules, ...builtinModules.map(name => `node:${name}`)];

export default defineConfig({
  publicDir: false,
  build: {
    outDir: resolve("dist/electron"),
    emptyOutDir: false,
    lib: {
      entry: resolve("src/electron/main.ts"),
      formats: ["cjs"],
      fileName: () => "main.cjs"
    },
    rollupOptions: { external }
  }
});
