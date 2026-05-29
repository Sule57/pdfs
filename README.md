# PDF Tools

Browser-based Word to PDF conversion and PDF merging for [pdf.susic-security.com](https://pdf.susic-security.com). Files are processed locally; nothing is uploaded to a server.

## Features

- **Word to PDF** — Upload multiple `.doc` / `.docx` files, convert with LibreOffice WASM, download individually or as a ZIP.
- **Combine PDFs** — Upload PDFs, reorder via drag-and-drop or buttons, download one merged file.

## Local development

```bash
npm install
npm run dev
```

Open the URL shown in the terminal. The dev server sets cross-origin isolation headers required for Word conversion.

## Build

```bash
npm run build
npm run preview
```

## Deploy to GitHub Pages

1. Create a repository (e.g. `Sule57/pdfs`) and push this project.
2. In the repo: **Settings → Pages → Build and deployment → Source**: GitHub Actions.
3. Push to `main`; the workflow in `.github/workflows/deploy.yml` builds and deploys `dist/`.
4. **Settings → Pages → Custom domain**: `pdf.susic-security.com`
5. DNS at your provider:
   - **Type:** CNAME  
   - **Name:** `pdf`  
   - **Target:** `sule57.github.io`
6. Wait for DNS and HTTPS (often 15–60 minutes).

## Word conversion modes

**Default (no extra headers):** `.docx` files convert with a built-in browser converter (mammoth + jsPDF). Works on GitHub Pages immediately. Layout may differ from Word; legacy `.doc` is not supported on this path.

**Full quality (optional):** LibreOffice WASM runs when `crossOriginIsolated` is `true`, which needs COOP/COEP headers (see below). Supports `.doc` and `.docx` with better fidelity.

Check which mode you are in (browser console on the convert page):

```js
crossOriginIsolated  // false = standard .docx mode, true = LibreOffice WASM
```

## Cross-origin headers (full-quality WASM)

LibreOffice WASM needs `SharedArrayBuffer`, which requires:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

GitHub Pages cannot set these headers. **Combine PDFs** works without them.

### Important: do not use Google Fonts with `require-corp`

Cross-origin font CDNs (e.g. Google Fonts) prevent the page from becoming cross-origin isolated. This project **self-hosts Inter** via `@fontsource/inter` instead.

### Cloudflare Response Header Transform Rule

1. Proxy `pdf` CNAME through Cloudflare (orange cloud).
2. **Rules → Transform Rules → Response Header Transform Rules → Create rule**
3. **Expression:** `(http.host eq "pdf.susic-security.com")`
4. **Set static** headers on the same rule:

| Header name | Value |
|-------------|--------|
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Embedder-Policy` | `require-corp` |
| `Cross-Origin-Resource-Policy` | `cross-origin` |

5. Deploy the rule and purge cache if you changed headers on a live site.

Verify headers are actually applied (must show both lines):

```bash
curl -sI https://pdf.susic-security.com/ | grep -i cross-origin
```

If nothing is returned, the Transform Rule is missing, on the wrong rule type (**Response**, not Request), or the hostname does not match.

### Optional: Cloudflare Worker

If Transform Rules do not apply, deploy [`cloudflare/worker.js`](cloudflare/worker.js) with [Wrangler](https://developers.cloudflare.com/workers/wrangler/) and route `pdf.susic-security.com/*` to the worker (see [`wrangler.toml`](wrangler.toml)).

## Tech stack

- [Vite](https://vitejs.dev/) + TypeScript
- [@fontsource/inter](https://fontsource.org/fonts/inter) — self-hosted fonts
- [pdf-lib](https://pdf-lib.js.org/) — merge PDFs
- [@matbee/libreoffice-converter](https://github.com/matbeedotcom/libreoffice-document-converter) — full-quality Word → PDF (when isolated)
- [mammoth](https://www.npmjs.com/package/mammoth) + [jsPDF](https://github.com/parallax/jsPDF) — standard `.docx` conversion fallback
- [JSZip](https://stuk.github.io/jszip/) — batch download

## License

MPL-2.0 applies to LibreOffice WASM components; site code is MIT unless otherwise noted.
