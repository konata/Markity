import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const chrome = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const dist = resolve(root, "dist/chrome");
const key = resolve(root, "keys/chrome.pem");
const profile = resolve(root, ".pack/chrome-profile");
const crx = resolve(root, "dist/chrome.crx");
const pem = resolve(root, "dist/chrome.pem");
const artifact = resolve(root, "artifacts/chrome/markity-chrome.crx");

if (!existsSync(chrome)) throw new Error(`Chrome not found: ${chrome}`);
if (!existsSync(resolve(dist, "manifest.json"))) throw new Error("Run `bun run build` before packing.");

await mkdir(dirname(key), { recursive: true });
await mkdir(dirname(artifact), { recursive: true });
await rm(profile, { recursive: true, force: true });
await rm(crx, { force: true });
await rm(artifact, { force: true });

const args = [
  `--user-data-dir=${profile}`,
  "--no-first-run",
  "--no-default-browser-check",
  `--pack-extension=${dist}`,
  ...(existsSync(key) ? [`--pack-extension-key=${key}`] : [])
];
const result = spawnSync(chrome, args, { stdio: "inherit" });
await rm(profile, { recursive: true, force: true });

if (result.status !== 0) process.exit(result.status ?? 1);
if (!existsSync(crx)) throw new Error("Chrome did not create dist.crx.");

await rename(crx, artifact);
if (!existsSync(key) && existsSync(pem)) await rename(pem, key);

console.log(`Packed ${artifact}`);
console.log(`Key ${key}`);
