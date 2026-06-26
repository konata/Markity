import { packager } from "@electron/packager";
import { spawnSync } from "node:child_process";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist/electron");
const stage = resolve(root, ".pack/electron-app");
const out = resolve(root, "artifacts/electron");
const arches = ["arm64", "x64"] as const;
const chosen = process.env.MARKITY_ARCH || (process.arch === "arm64" ? "arm64" : "x64");
const plist = {
  CFBundleDocumentTypes: [
    {
      CFBundleTypeName: "Markdown Document",
      CFBundleTypeRole: "Viewer",
      CFBundleTypeExtensions: ["md"],
      LSHandlerRank: "Owner"
    },
    {
      CFBundleTypeName: "Markdown Document",
      CFBundleTypeRole: "Viewer",
      CFBundleTypeExtensions: ["markdown", "mkd"],
      LSHandlerRank: "Alternate"
    },
    {
      CFBundleTypeName: "MDX Document",
      CFBundleTypeRole: "Viewer",
      CFBundleTypeExtensions: ["mdx", "mdc"],
      LSHandlerRank: "Alternate",
      LSItemContentTypes: ["local.konata.markity.mdx"]
    },
    {
      CFBundleTypeName: "Plain Text Document",
      CFBundleTypeRole: "Viewer",
      CFBundleTypeExtensions: ["txt"],
      LSHandlerRank: "Alternate",
      LSItemContentTypes: ["public.plain-text"]
    }
  ],
  UTImportedTypeDeclarations: [
    {
      UTTypeIdentifier: "local.konata.markity.mdx",
      UTTypeDescription: "MDX Document",
      UTTypeConformsTo: ["public.plain-text"],
      UTTypeTagSpecification: {
        "public.filename-extension": ["mdx", "mdc"]
      }
    }
  ]
};

if (!arches.includes(chosen as typeof arches[number])) throw new Error(`Unsupported arch: ${chosen}`);
const arch = chosen as typeof arches[number];
const zip = resolve(out, `markity-electron-macos-${arch}.zip`);

await rm(stage, { recursive: true, force: true });
await rm(out, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
await cp(dist, stage, { recursive: true });
await writeFile(resolve(stage, "package.json"), JSON.stringify({ name: "markity", productName: "Markity", version: "0.1.3", main: "main.cjs" }));

const app = await packager({
  dir: stage,
  name: "Markity",
  platform: "darwin",
  arch,
  appBundleId: "local.konata.markity",
  extendInfo: plist,
  icon: resolve(root, "build/icon.icns"),
  asar: true,
  out,
  overwrite: true,
  quiet: true
});

const result = spawnSync("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", resolve(app[0], "Markity.app"), zip], { stdio: "inherit" });
if (result.status !== 0) process.exit(result.status ?? 1);

console.log(`Packed ${app.join("\nPacked ")}`);
console.log(`Packed ${zip}`);
