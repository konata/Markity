import { packager } from "@electron/packager";
import { spawnSync } from "node:child_process";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist/electron");
const stage = resolve(root, ".pack/electron-app");
const out = resolve(root, "artifacts/electron");
const arch = process.arch === "arm64" ? "arm64" : "x64";
const zip = resolve(out, `markity-electron-macos-${arch}.zip`);

await rm(stage, { recursive: true, force: true });
await rm(out, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
await cp(dist, stage, { recursive: true });
await writeFile(resolve(stage, "package.json"), JSON.stringify({ name: "markity", productName: "Markity", version: "0.1.0", main: "main.cjs" }));

const app = await packager({
  dir: stage,
  name: "Markity",
  platform: "darwin",
  arch,
  appBundleId: "local.konata.markity",
  asar: true,
  out,
  overwrite: true,
  quiet: true
});

const result = spawnSync("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", resolve(app[0], "Markity.app"), zip], { stdio: "inherit" });
if (result.status !== 0) process.exit(result.status ?? 1);

console.log(`Packed ${app.join("\nPacked ")}`);
console.log(`Packed ${zip}`);
