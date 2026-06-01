import { markdownToHtml } from '../lib/markdown/parse'
import { exportPreviewToPdf, mdPdfFilename } from '../lib/markdown/export-pdf'
import { validateMdFile } from '../lib/validate'

const DEFAULT_MARKDOWN = `# Hello

Write **Markdown** here or upload a \`.md\` file.

- Live preview updates as you type
- Download the rendered page as PDF

## Tables (GFM)

| Feature | Supported |
|---------|-----------|
| Headings | Yes |
| Lists | Yes |
`

let uploadedFileName: string | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null

export function renderMarkdown(container: HTMLElement): void {
  uploadedFileName = null

  container.innerHTML = `
    <header class="site-header">
      <a href="#/" class="back-link">← Back</a>
      <span class="site-logo">Markdown <span>to PDF</span></span>
    </header>
    <h1 class="page-title">Markdown to PDF</h1>
    <p class="page-subtitle">Paste or upload Markdown, preview the rendered output, then download as PDF.</p>
    <p class="editor-hint">PDF export rasterizes the preview; very long documents may take a moment. External images need to allow cross-origin loading.</p>
    <div class="md-toolbar">
      <label class="btn btn-secondary md-upload-btn">
        Upload .md
        <input type="file" id="md-file-input" accept=".md,.markdown,text/markdown" hidden />
      </label>
      <button type="button" class="btn btn-secondary" id="md-clear">Clear</button>
      <button type="button" class="btn btn-primary" id="md-download">Download PDF</button>
    </div>
    <div class="md-workspace">
      <div class="md-pane md-pane-editor">
        <label class="md-pane-label" for="md-source">Markdown</label>
        <textarea id="md-source" class="md-editor" spellcheck="false">${escapeHtml(DEFAULT_MARKDOWN)}</textarea>
      </div>
      <div class="md-pane md-pane-preview">
        <span class="md-pane-label">Preview</span>
        <div class="md-preview-pane">
          <div id="md-preview" class="md-preview prose"></div>
        </div>
      </div>
    </div>
    <div id="md-error" class="alert alert-error" hidden></div>
  `

  const source = container.querySelector('#md-source') as HTMLTextAreaElement
  const preview = container.querySelector('#md-preview') as HTMLElement
  const fileInput = container.querySelector('#md-file-input') as HTMLInputElement
  const downloadBtn = container.querySelector('#md-download') as HTMLButtonElement
  const clearBtn = container.querySelector('#md-clear') as HTMLButtonElement
  const errorEl = container.querySelector('#md-error') as HTMLElement

  const showError = (msg: string) => {
    errorEl.textContent = msg
    errorEl.hidden = !msg
  }

  const updatePreview = () => {
    const md = source.value
    if (!md.trim()) {
      preview.innerHTML = '<p class="md-empty">Nothing to preview yet.</p>'
      return
    }
    try {
      preview.innerHTML = markdownToHtml(md)
      showError('')
    } catch {
      showError('Could not parse this Markdown.')
    }
  }

  const schedulePreview = () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(updatePreview, 200)
  }

  source.addEventListener('input', schedulePreview)

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0]
    fileInput.value = ''
    if (!file) return
    const err = validateMdFile(file)
    if (err) {
      showError(err)
      return
    }
    try {
      source.value = await file.text()
      uploadedFileName = file.name
      updatePreview()
      showError('')
    } catch {
      showError('Could not read this file.')
    }
  })

  clearBtn.addEventListener('click', () => {
    source.value = ''
    uploadedFileName = null
    updatePreview()
    showError('')
  })

  downloadBtn.addEventListener('click', async () => {
    if (!source.value.trim()) {
      showError('Add some Markdown before downloading.')
      return
    }
    if (!preview.textContent?.trim() && !preview.querySelector('img, table, h1')) {
      showError('Preview is empty. Check your Markdown.')
      return
    }

    downloadBtn.disabled = true
    downloadBtn.textContent = 'Generating…'
    showError('')

    try {
      await exportPreviewToPdf(preview, mdPdfFilename(uploadedFileName))
    } catch {
      showError('PDF export failed. Try a shorter document or fewer images.')
    } finally {
      downloadBtn.disabled = false
      downloadBtn.textContent = 'Download PDF'
    }
  })

  updatePreview()
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
