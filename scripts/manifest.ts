import { copyFile, cp, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const target = process.argv[2];
if (target !== "chrome" && target !== "firefox") throw new Error("Usage: bun scripts/manifest.ts chrome|firefox");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist", target);

await mkdir(dist, { recursive: true });
await copyFile(resolve(root, "manifests", `${target}.json`), resolve(dist, "manifest.json"));
await cp(resolve(root, "manifests/icons"), resolve(dist, "icons"), { recursive: true });
