import { markdownToHtml } from '../lib/markdown/parse'
import { exportPreviewToPdf, mdPdfFilename } from '../lib/markdown/export-pdf'
import { validateMdFile } from '../lib/validate'

const DEFAULT_MARKDOWN = `# Hello

Write **Markdown** here or upload a \`.md\` file.

- Switch to **Preview** to see the rendered output
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
    <p class="page-subtitle">Write Markdown in the Edit tab, check Preview, then download as PDF.</p>
    <p class="editor-hint">PDF export rasterizes the preview; very long documents may take a moment. External images need to allow cross-origin loading.</p>
    <div class="md-editor-card">
      <div class="md-card-header">
        <div class="md-tabs" role="tablist" aria-label="Editor mode">
          <button type="button" class="md-tab active" role="tab" id="md-tab-edit" aria-selected="true" aria-controls="md-panel-edit">Edit</button>
          <button type="button" class="md-tab" role="tab" id="md-tab-preview" aria-selected="false" aria-controls="md-panel-preview">Preview</button>
        </div>
        <div class="md-toolbar-actions">
          <label class="btn btn-secondary md-upload-btn">
            Upload .md
            <input type="file" id="md-file-input" accept=".md,.markdown,text/markdown" hidden />
          </label>
          <button type="button" class="btn btn-secondary" id="md-clear">Clear</button>
          <button type="button" class="btn btn-primary" id="md-download">Download PDF</button>
        </div>
      </div>
      <div class="md-card-body">
        <div class="md-pane-edit" id="md-panel-edit" role="tabpanel" aria-labelledby="md-tab-edit">
          <textarea id="md-source" class="md-editor" spellcheck="false">${escapeHtml(DEFAULT_MARKDOWN)}</textarea>
        </div>
        <div class="md-pane-preview md-pane-hidden" id="md-panel-preview" role="tabpanel" aria-labelledby="md-tab-preview" hidden>
          <div class="md-preview-pane">
            <div id="md-preview" class="md-preview prose"></div>
          </div>
        </div>
      </div>
    </div>
    <div id="md-error" class="alert alert-error" hidden></div>
  `

  const source = container.querySelector('#md-source') as HTMLTextAreaElement
  const preview = container.querySelector('#md-preview') as HTMLElement
  const panelEdit = container.querySelector('#md-panel-edit') as HTMLElement
  const panelPreview = container.querySelector('#md-panel-preview') as HTMLElement
  const tabEdit = container.querySelector('#md-tab-edit') as HTMLButtonElement
  const tabPreview = container.querySelector('#md-tab-preview') as HTMLButtonElement
  const fileInput = container.querySelector('#md-file-input') as HTMLInputElement
  const downloadBtn = container.querySelector('#md-download') as HTMLButtonElement
  const clearBtn = container.querySelector('#md-clear') as HTMLButtonElement
  const errorEl = container.querySelector('#md-error') as HTMLElement

  const showError = (msg: string) => {
    errorEl.textContent = msg
    errorEl.hidden = !msg
  }

  const flushPreview = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
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
    flushPreview()
    debounceTimer = setTimeout(updatePreview, 200)
  }

  const setViewMode = (mode: 'edit' | 'preview') => {
    const isEdit = mode === 'edit'

    tabEdit.classList.toggle('active', isEdit)
    tabPreview.classList.toggle('active', !isEdit)
    tabEdit.setAttribute('aria-selected', String(isEdit))
    tabPreview.setAttribute('aria-selected', String(!isEdit))

    panelEdit.classList.toggle('md-pane-hidden', !isEdit)
    panelPreview.classList.toggle('md-pane-hidden', isEdit)
    panelEdit.hidden = !isEdit
    panelPreview.hidden = isEdit

    if (!isEdit) {
      flushPreview()
      updatePreview()
    }
  }

  tabEdit.addEventListener('click', () => setViewMode('edit'))
  tabPreview.addEventListener('click', () => setViewMode('preview'))

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
    setViewMode('edit')
  })

  downloadBtn.addEventListener('click', async () => {
    if (!source.value.trim()) {
      showError('Add some Markdown before downloading.')
      return
    }

    flushPreview()
    updatePreview()

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
