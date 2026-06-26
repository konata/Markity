import { spawnSync } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const svg = resolve(root, "site/assets/icon.svg");
const siteAssets = resolve(root, "site/assets");
const extensionIcons = resolve(root, "manifests/icons");
const build = resolve(root, "build");
const iconset = resolve(build, "icon.iconset");
const master = resolve(build, "icon-1024.png");
const electron = process.argv[2] === "electron";

const run = (cmd: string, args: string[]) => {
  const { status } = spawnSync(cmd, args, { stdio: "inherit" });
  if (status !== 0) throw new Error(`${cmd} exited ${status}`);
};
const png = (size: number, file: string) => run("sips", ["-s", "format", "png", "-z", String(size), String(size), master, "--out", file]);

await mkdir(build, { recursive: true });
await rm(iconset, { recursive: true, force: true });
await mkdir(iconset, { recursive: true });

// rsvg-convert preserves the SVG's transparency; qlmanage flattens it onto an opaque background.
run("rsvg-convert", ["-w", "1024", "-h", "1024", svg, "-o", master]);

if (!electron) {
  for (const size of [512, 256, 128]) png(size, resolve(siteAssets, `icon-${size}.png`));
  await mkdir(extensionIcons, { recursive: true });
  for (const size of [16, 32, 48, 128]) png(size, resolve(extensionIcons, `icon-${size}.png`));
}

for (const [size, name] of [
  [16, "icon_16x16"], [32, "icon_16x16@2x"], [32, "icon_32x32"], [64, "icon_32x32@2x"],
  [128, "icon_128x128"], [256, "icon_128x128@2x"], [256, "icon_256x256"], [512, "icon_256x256@2x"],
  [512, "icon_512x512"], [1024, "icon_512x512@2x"]
] as const) png(size, resolve(iconset, `${name}.png`));
run("iconutil", ["-c", "icns", iconset, "-o", resolve(build, "icon.icns")]);

console.log(electron ? "wrote build/icon.icns" : "wrote site/assets + manifests/icons PNGs and build/icon.icns");
