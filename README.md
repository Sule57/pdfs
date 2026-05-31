# PDF Tools

Browser-based PDF merging for [pdf.susic-security.com](https://pdf.susic-security.com). Files stay in your browser; nothing is uploaded to a server.

## Features

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

No special HTTP headers are required. If you previously added COOP/COEP/CORP headers for Word conversion, remove them and purge cache.

## Tech stack

- [Vite](https://vitejs.dev/) + TypeScript
- [pdf-lib](https://pdf-lib.js.org/) — merge PDFs
- [@fontsource/inter](https://fontsource.org/fonts/inter) — fonts

## License

MIT for site code unless otherwise noted.
