# Markity

Quiet Markdown reader for local and remote Markdown files.

This repo ships the reader from one renderer across:

- Chrome extension
- Firefox extension
- macOS app (Tauri, in `macos/`)

The Electron app (`src/electron/main.ts`) is **deprecated** — its source is kept
but it is no longer built or released. The branding/download site lives in `site/`.

## Setup

```sh
bun install
```

Building the macOS app additionally needs the Rust toolchain (`rustup`, stable).
Regenerating icons (`bun run icons`) needs `rsvg-convert` (`brew install librsvg`).

## Development

```sh
bun run check        # tsc + build the web targets
bun run tauri:dev    # run the macOS app (Tauri)
bun run start:site   # preview the site
```

For browser extensions, build the unpacked extension and load the directory:

```sh
bun run build:chrome
# load dist/chrome in chrome://extensions (Developer mode → Load unpacked)

bun run build:firefox
# load dist/firefox/manifest.json in about:debugging
```

Chrome needs "Allow access to file URLs" enabled for local Markdown files.

## macOS app (`macos/`)

A Tauri v2 app. The Rust backend (`macos/src/lib.rs`) exposes the file/folder
bridge, a native open panel, the app menu, Install CLI and the
Move-to-Applications prompt. The whole TypeScript renderer is reused: `index.html`
loads `src/electron/entry.tauri.ts`, which installs a `window.markity` shim
(`src/electron/bridge.tauri.ts`) over Tauri's `invoke`.

```sh
bun run tauri:dev      # dev
bun run tauri:build    # release → macos/target/release/bundle/macos/Markity.app
```

## Packaging

```sh
bun run pack:chrome
bun run pack:firefox
bun run tauri:build
```

Artifacts:

- `artifacts/chrome/markity-chrome.zip`
- `artifacts/firefox/markity-firefox.xpi`
- `macos/target/release/bundle/macos/Markity.app` (zipped to `markity-macos-arm64.zip` in CI)

`bun run icons` regenerates the committed site/extension/Tauri PNGs and `.icns`
from `site/assets/icon.svg`, using `rsvg-convert` to preserve transparency. Run it
only when the icon changes.

## Release

Push a `v*` tag or run the Release workflow manually. The workflow builds the
Chrome, Firefox and macOS (Tauri) artifacts and attaches them to the GitHub
Release; the site download buttons point at the stable `latest/download` URLs.
Electron is not built in CI.

## Site

`site/` is the static landing/branding page — plain HTML, CSS and a little JS, no
build step — deployed to Cloudflare Pages at `markity.pages.dev`.

```
site/
  index.html   single-page landing
  styles.css   warm-paper / forest-green theme (light + dark)
  app.js       theme toggle
  assets/      icon, favicon, social preview PNGs
  serve.ts     local preview server
  _headers     Cloudflare Pages cache + security headers
```

Preview locally:

```sh
bun run start:site
```

Deploy manually to Cloudflare Pages (no framework, no build command, output `site/`):

```sh
bunx wrangler pages deploy site --project-name markity
```

## Generated Files

These paths are intentionally ignored:

- `dist/`
- `artifacts/`
- `.pack/`
- `build/`
- `macos/target/`, `macos/gen/`
- `keys/`
- `node_modules/`
