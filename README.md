# PDF Tools

Browser-based PDF editing and merging for [pdf.susic-security.com](https://pdf.susic-security.com). Files stay in your browser; nothing is uploaded to a server.

## Features

- **Edit PDF** — Upload a PDF, manage pages (add, delete, reorder), add text and images, whiteout regions with optional replacement text, then download.
- **Combine PDFs** — Upload multiple PDFs, reorder, and download one merged file.

## Local development

```bash
npm install
npm run dev
```

Open the URL from the terminal (e.g. `http://localhost:5173`).

## Build

```bash
npm run build
npm run preview
```

## Deploy to GitHub Pages

1. Push to `main` on your `pdfs` repository.
2. **Settings → Pages → Build and deployment → Source**: GitHub Actions.
3. Custom domain: `pdf.susic-security.com` with DNS CNAME `pdf` → `sule57.github.io`.

## Cloudflare

No special HTTP headers are required for this app. If you previously added headers for Word conversion, **remove** them:

| Header | Action |
|--------|--------|
| `Cross-Origin-Opener-Policy` | Remove |
| `Cross-Origin-Embedder-Policy` | Remove |
| `Cross-Origin-Resource-Policy` | Remove |

Then purge Cloudflare cache. Combine PDFs and the editor work on standard GitHub Pages.

## Edit PDF limitations

- Added text, images, and whiteout boxes are **layered on top** when you export; this is not full Acrobat-style editing of existing PDF content.
- Images already embedded in the PDF cannot be moved individually; add new images on top instead.
- Legacy `.doc` / Word conversion is not supported.

## Tech stack

- [Vite](https://vitejs.dev/) + TypeScript
- [pdf-lib](https://pdf-lib.js.org/) — structure, annotations, export
- [PDF.js](https://mozilla.github.io/pdf.js/) — page preview
- [@fontsource/inter](https://fontsource.org/fonts/inter) — fonts

## License

MIT for site code unless otherwise noted.
