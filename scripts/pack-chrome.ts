import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist/chrome");
const artifact = resolve(root, "artifacts/chrome/markity-chrome.zip");

if (!existsSync(resolve(dist, "manifest.json"))) throw new Error("Run `bun run build:chrome` before packing.");

await mkdir(dirname(artifact), { recursive: true });
await rm(artifact, { force: true });

const result = spawnSync("zip", ["-qr", artifact, ".", "-x", "*.DS_Store", "__MACOSX/*"], { cwd: dist, stdio: "inherit" });
if (result.status !== 0) process.exit(result.status ?? 1);

console.log(`Packed ${artifact} (unzip, then load unpacked at chrome://extensions)`);
