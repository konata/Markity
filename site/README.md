# Markity — branding site

Static landing/branding site for Markity. No build step — plain HTML, CSS and a few
lines of JS. Deploys to Cloudflare Pages at `markity.pages.dev`.

## Layout

```
site/
  index.html      single-page landing
  styles.css      warm-paper / forest-green theme (light + dark)
  app.js          theme toggle + year
  assets/         icon / favicon / social preview images
  serve.ts        local preview server
  _headers        Cloudflare Pages cache + security headers
```

## Local preview

```sh
bun run start:site
```

## Deploy to Cloudflare Pages

Project is already provisioned (`markity.pages.dev`). Publish the `site/` directory:

```sh
bunx wrangler pages deploy site --project-name markity
```

- Framework preset: none
- Build command: (empty)
- Build output directory: `site`

## Downloads

All three buttons link to GitHub Releases via the stable `latest/download` path, which
always resolves to the newest release:

```
https://github.com/konata/markity/releases/latest/download/markity-chrome.zip
https://github.com/konata/markity/releases/latest/download/markity-firefox.xpi
https://github.com/konata/markity/releases/latest/download/markity-electron-macos-arm64.zip
```

No per-version edits are needed as long as the asset filenames (from `scripts/pack-*.ts`)
stay the same. The macOS app (~128 MB) can't live on Cloudflare Pages (25 MB/file limit),
so Releases is the source of truth for downloads.
