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

## Cross-origin headers (Word conversion)

LibreOffice WASM needs `SharedArrayBuffer`, which requires:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

GitHub Pages does not let you set custom response headers. **Combine PDFs** works without them; **Word to PDF** needs one of:

1. **Cloudflare (free)** — Proxy `pdf.susic-security.com` through Cloudflare and add a **Transform Rule** (or **Configuration Rule**) to set both headers on responses for that hostname.
2. **Local / preview** — `npm run dev` and `npm run preview` already send these headers via Vite.

### Cloudflare example (free plan)

1. Add the site to Cloudflare and point `pdf` CNAME to `sule57.github.io` (proxied / orange cloud).
2. **Rules → Transform Rules → Modify Response Header**:
   - Add `Cross-Origin-Opener-Policy` = `same-origin`
   - Add `Cross-Origin-Embedder-Policy` = `require-corp`
3. Scope the rule to hostname `pdf.susic-security.com`.

## Tech stack

- [Vite](https://vitejs.dev/) + TypeScript
- [pdf-lib](https://pdf-lib.js.org/) — merge PDFs
- [@matbee/libreoffice-converter](https://github.com/matbeedotcom/libreoffice-document-converter) — Word → PDF in the browser
- [JSZip](https://stuk.github.io/jszip/) — batch download

## License

MPL-2.0 applies to LibreOffice WASM components; site code is MIT unless otherwise noted.
