# Markity

Quiet Markdown reader for local and remote Markdown files.

This repo ships three readers from one renderer:

- Chrome extension
- Firefox extension
- macOS Electron app

The branding/download site lives in `site/`.

## Setup

```sh
bun install
```

## Development

```sh
bun run check
bun run start:electron
bun run start:site
```

For browser extension development, build the unpacked extension and load the
directory from the browser:

```sh
bun run build:chrome
# load dist/chrome in chrome://extensions

bun run build:firefox
# load dist/firefox/manifest.json in about:debugging
```

Chrome needs "Allow access to file URLs" enabled for local Markdown files.

## Packaging

```sh
bun run pack:chrome
bun run pack:firefox
MARKITY_ARCH=arm64 bun run pack:electron
```

Artifacts are written under `artifacts/`:

- `artifacts/chrome/markity-chrome.zip`
- `artifacts/firefox/markity-firefox.xpi`
- `artifacts/electron/markity-electron-macos-arm64.zip`

`pack:electron` generates the macOS icon into `build/` from
`site/assets/icon.svg`. Run `bun run icons` only when the committed site PNGs
should be refreshed.

## Release

Push a `v*` tag or run the Release workflow manually. The workflow builds all
three artifacts and attaches them to the GitHub Release. The site download
buttons point at the stable GitHub Releases `latest/download` URLs.

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
- `keys/`
- `node_modules/`
