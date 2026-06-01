# PDF Tools

Browser-based PDF utilities for [pdf.susic-security.com](https://pdf.susic-security.com). Files stay in your browser; nothing is uploaded to a server.

## Features

- **Combine PDFs** — Upload multiple PDFs, reorder, and download one merged file.
- **Markdown to PDF** — Paste or upload Markdown, live HTML preview, download as PDF.

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

No special HTTP headers are required. If you previously added COOP/COEP/CORP headers for Word conversion, remove them and purge cache.

## Markdown to PDF limitations

- Export **rasterizes** the preview (html2canvas); text in the PDF is not selectable.
- Long documents may be slow or use significant memory.
- External images must allow cross-origin access to appear in the PDF.
- Preview uses GitHub-flavored Markdown (tables, etc.) but may not match GitHub pixel-for-pixel.

## Tech stack

- [Vite](https://vitejs.dev/) + TypeScript
- [pdf-lib](https://pdf-lib.js.org/) — merge PDFs
- [marked](https://marked.js.org/) + [DOMPurify](https://github.com/cure53/DOMPurify) — Markdown preview
- [html2pdf.js](https://github.com/eKoopmans/html2pdf.js) — Markdown export
- [@fontsource/inter](https://fontsource.org/fonts/inter) — fonts

## License

MIT for site code unless otherwise noted.
