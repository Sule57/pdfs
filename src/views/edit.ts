import { downloadBlob, editedPdfFilename } from '../lib/download'
import { validatePdfFile, validateImageFile } from '../lib/validate'
import { getPdfPageCount } from '../lib/editor/load-pdf'
import {
  renderPageToCanvas,
  renderThumbnail,
  canvasToPdfCoords,
  clearPdfRenderCache,
  type RenderResult,
} from '../lib/editor/render-page'
import { exportEditedPdf } from '../lib/editor/apply-edits'
import {
  extractPageTextSpans,
  type PdfTextSpan,
} from '../lib/editor/extract-text'
import {
  createEditorState,
  newId,
  type EditorState,
  type ToolMode,
  type ImageAnnotation,
  type PdfTextEdit,
} from '../lib/editor/types'

let state: EditorState | null = null
let activePageIndex = 0
let toolMode: ToolMode = 'select'
let renderMeta: RenderResult | null = null
let selectedAnnotationId: string | null = null
let pendingImageBytes: { bytes: Uint8Array; mime: 'image/png' | 'image/jpeg' } | null =
  null
let whiteoutStart: { x: number; y: number } | null = null
const spansByPage = new Map<number, PdfTextSpan[]>()

export function renderEdit(container: HTMLElement): void {
  if (!state) {
    renderUpload(container)
    return
  }
  renderEditor(container)
}

function renderUpload(container: HTMLElement): void {
  container.innerHTML = `
    <header class="site-header">
      <a href="#/" class="back-link">← Back</a>
      <span class="site-logo">Edit <span>PDF</span></span>
    </header>
    <h1 class="page-title">Edit PDF</h1>
    <p class="page-subtitle">Upload a PDF to edit existing text, add overlays, and manage pages — all in your browser.</p>
    <p class="editor-hint">Text-based PDFs can be edited in Select mode. Scanned PDFs have no selectable text — use whiteout or a desktop OCR tool.</p>
    <div class="drop-zone" id="edit-drop" role="button" tabindex="0">
      <input type="file" id="edit-input" accept=".pdf,application/pdf" />
      <div class="drop-zone-icon" aria-hidden="true">↑</div>
      <p>Drop a PDF here or click to browse</p>
      <p class="hint">Max 50MB</p>
    </div>
    <div id="edit-error" class="alert alert-error" hidden></div>
  `

  const drop = container.querySelector('#edit-drop') as HTMLElement
  const input = container.querySelector('#edit-input') as HTMLInputElement
  const errorEl = container.querySelector('#edit-error') as HTMLElement

  const showError = (msg: string) => {
    errorEl.textContent = msg
    errorEl.hidden = !msg
  }

  const loadFile = async (file: File) => {
    showError('')
    const err = validatePdfFile(file)
    if (err) {
      showError(err)
      return
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const count = await getPdfPageCount(bytes)
      if (count === 0) {
        showError('PDF has no pages.')
        return
      }
      clearPdfRenderCache()
      clearSpansCache()
      state = createEditorState(bytes, file.name, count)
      activePageIndex = 0
      selectedAnnotationId = null
      renderEdit(container)
    } catch {
      showError('Could not open this PDF.')
    }
  }

  drop.addEventListener('click', () => input.click())
  drop.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      input.click()
    }
  })
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    if (file) void loadFile(file)
    input.value = ''
  })
  drop.addEventListener('dragover', (e) => {
    e.preventDefault()
    drop.classList.add('drag-over')
  })
  drop.addEventListener('dragleave', () => drop.classList.remove('drag-over'))
  drop.addEventListener('drop', (e) => {
    e.preventDefault()
    drop.classList.remove('drag-over')
    const file = e.dataTransfer?.files?.[0]
    if (file) void loadFile(file)
  })
}

function renderEditor(container: HTMLElement): void {
  if (!state) return

  container.innerHTML = `
    <header class="site-header editor-header">
      <a href="#/" class="back-link">← Back</a>
      <span class="site-logo">Edit <span>PDF</span></span>
      <button type="button" class="btn btn-secondary btn-sm" id="edit-new">New file</button>
    </header>
    <p class="editor-filename">${escapeHtml(state.fileName)} · ${state.pages.length} page${state.pages.length === 1 ? '' : 's'}</p>
    <div class="editor-toolbar">
      <div class="tool-group" role="group" aria-label="Tools">
        <button type="button" class="btn btn-secondary tool-btn" data-tool="select">Select</button>
        <button type="button" class="btn btn-secondary tool-btn" data-tool="text">Text</button>
        <button type="button" class="btn btn-secondary tool-btn" data-tool="image">Image</button>
        <button type="button" class="btn btn-secondary tool-btn" data-tool="whiteout">Whiteout</button>
      </div>
      <div class="tool-group" role="group" aria-label="Pages">
        <button type="button" class="btn btn-secondary btn-sm" id="page-add">+ Page</button>
        <button type="button" class="btn btn-secondary btn-sm" id="page-delete">Delete</button>
        <button type="button" class="btn btn-secondary btn-sm" id="page-up">↑</button>
        <button type="button" class="btn btn-secondary btn-sm" id="page-down">↓</button>
      </div>
      <button type="button" class="btn btn-primary" id="edit-download">Download PDF</button>
    </div>
    <input type="file" id="image-input" accept="image/png,image/jpeg" hidden />
    <div class="editor-layout">
      <aside class="editor-thumbs" id="thumbs"></aside>
      <div class="editor-main">
        <div class="canvas-wrap" id="canvas-wrap">
          <canvas id="page-canvas"></canvas>
          <div id="pdf-text-layer" class="pdf-text-layer" hidden></div>
          <div id="annotation-layer" class="annotation-layer"></div>
        </div>
        <p class="editor-hint" id="tool-hint"></p>
      </div>
    </div>
    <div id="edit-error" class="alert alert-error" hidden></div>
  `

  container.querySelector('#edit-new')?.addEventListener('click', () => {
    clearPdfRenderCache()
    clearSpansCache()
    state = null
    renderEdit(container)
  })

  container.querySelectorAll('[data-tool]').forEach((btn) => {
    btn.addEventListener('click', () => {
      toolMode = (btn as HTMLElement).dataset.tool as ToolMode
      pendingImageBytes = null
      updateToolButtons(container)
      updateToolHint(container)
      void drawPdfTextOverlays(container)
    })
  })

  container.querySelector('#page-add')?.addEventListener('click', () => {
    if (!state) return
    state.pages.splice(activePageIndex + 1, 0, { type: 'blank' })
    reindexAnnotationsAfterPageInsert(activePageIndex + 1)
    activePageIndex++
    refreshEditor(container)
  })

  container.querySelector('#page-delete')?.addEventListener('click', () => {
    if (!state || state.pages.length <= 1) return
    state.pages.splice(activePageIndex, 1)
    reindexAnnotationsAfterPageDelete(activePageIndex)
    activePageIndex = Math.min(activePageIndex, state.pages.length - 1)
    refreshEditor(container)
  })

  container.querySelector('#page-up')?.addEventListener('click', () => {
    if (!state || activePageIndex <= 0) return
    swapPages(activePageIndex, activePageIndex - 1)
    activePageIndex--
    refreshEditor(container)
  })

  container.querySelector('#page-down')?.addEventListener('click', () => {
    if (!state || activePageIndex >= state.pages.length - 1) return
    swapPages(activePageIndex, activePageIndex + 1)
    activePageIndex++
    refreshEditor(container)
  })

  container.querySelector('#edit-download')?.addEventListener('click', async () => {
    if (!state) return
    const btn = container.querySelector('#edit-download') as HTMLButtonElement
    const errorEl = container.querySelector('#edit-error') as HTMLElement
    btn.disabled = true
    btn.textContent = 'Exporting…'
    errorEl.hidden = true
    try {
      const pdf = await exportEditedPdf(state)
      downloadBlob(pdf, editedPdfFilename(state.fileName))
    } catch {
      errorEl.textContent = 'Export failed. Try a smaller PDF or fewer images.'
      errorEl.hidden = false
    } finally {
      btn.disabled = false
      btn.textContent = 'Download PDF'
    }
  })

  const imageInput = container.querySelector('#image-input') as HTMLInputElement
  imageInput.addEventListener('change', async () => {
    const file = imageInput.files?.[0]
    imageInput.value = ''
    if (!file) return
    const err = validateImageFile(file)
    if (err) {
      showEditError(container, err)
      return
    }
    const bytes = new Uint8Array(await file.arrayBuffer())
    pendingImageBytes = {
      bytes,
      mime: file.type === 'image/png' ? 'image/png' : 'image/jpeg',
    }
    updateToolHint(container)
  })

  setupCanvasInteraction(container)
  updateToolButtons(container)
  refreshEditor(container)
}

function showEditError(container: HTMLElement, msg: string): void {
  const errorEl = container.querySelector('#edit-error') as HTMLElement
  errorEl.textContent = msg
  errorEl.hidden = !msg
}

function updateToolButtons(container: HTMLElement): void {
  container.querySelectorAll('[data-tool]').forEach((btn) => {
    const el = btn as HTMLButtonElement
    el.classList.toggle('active', el.dataset.tool === toolMode)
  })
}

function updateToolHint(container: HTMLElement): void {
  const hint = container.querySelector('#tool-hint') as HTMLElement
  const hints: Record<ToolMode, string> = {
    select:
      'Click existing text to edit it inline. Click added text or images to select; drag images to move.',
    text: 'Click on the page to place text.',
    image: pendingImageBytes
      ? 'Click on the page to place the image.'
      : 'Choose an image first (Image tool opens file picker).',
    whiteout: 'Click and drag to draw a white rectangle; you will be prompted for replacement text.',
  }
  hint.textContent = hints[toolMode]
}

function clearSpansCache(): void {
  spansByPage.clear()
}

function swapPages(a: number, b: number): void {
  if (!state) return
  ;[state.pages[a], state.pages[b]] = [state.pages[b], state.pages[a]]
  for (const ann of state.annotations) {
    if (ann.pageIndex === a) ann.pageIndex = b
    else if (ann.pageIndex === b) ann.pageIndex = a
  }
  for (const edit of state.textEdits) {
    if (edit.pageIndex === a) edit.pageIndex = b
    else if (edit.pageIndex === b) edit.pageIndex = a
  }
  clearSpansCache()
}

function reindexAnnotationsAfterPageInsert(at: number): void {
  if (!state) return
  for (const ann of state.annotations) {
    if (ann.pageIndex >= at) ann.pageIndex++
  }
  for (const edit of state.textEdits) {
    if (edit.pageIndex >= at) edit.pageIndex++
  }
  clearSpansCache()
}

function reindexAnnotationsAfterPageDelete(at: number): void {
  if (!state) return
  state.annotations = state.annotations.filter((ann) => ann.pageIndex !== at)
  state.textEdits = state.textEdits.filter((edit) => edit.pageIndex !== at)
  for (const ann of state.annotations) {
    if (ann.pageIndex > at) ann.pageIndex--
  }
  for (const edit of state.textEdits) {
    if (edit.pageIndex > at) edit.pageIndex--
  }
  clearSpansCache()
}

async function refreshEditor(container: HTMLElement): Promise<void> {
  if (!state) return
  await refreshThumbnails(container)
  await refreshMainCanvas(container)
  await drawPdfTextOverlays(container)
  drawAnnotationOverlays(container)
}

async function refreshThumbnails(container: HTMLElement): Promise<void> {
  if (!state) return
  const thumbs = container.querySelector('#thumbs') as HTMLElement
  thumbs.innerHTML = ''

  for (let i = 0; i < state.pages.length; i++) {
    const wrap = document.createElement('button')
    wrap.type = 'button'
    wrap.className = `thumb-item${i === activePageIndex ? ' active' : ''}`
    wrap.title = `Page ${i + 1}`

    const canvas = document.createElement('canvas')
    wrap.appendChild(canvas)
    const label = document.createElement('span')
    label.className = 'thumb-label'
    label.textContent = `${i + 1}${state.pages[i].type === 'blank' ? ' (new)' : ''}`
    wrap.appendChild(label)

    wrap.addEventListener('click', () => {
      activePageIndex = i
      selectedAnnotationId = null
      refreshEditor(container)
    })

    thumbs.appendChild(wrap)
    void renderThumbnail(state.sourceBytes, state.pages[i], canvas, 100)
  }
}

async function refreshMainCanvas(container: HTMLElement): Promise<void> {
  if (!state) return
  const canvas = container.querySelector('#page-canvas') as HTMLCanvasElement
  renderMeta = await renderPageToCanvas(
    state.sourceBytes,
    state.pages[activePageIndex],
    canvas,
    1.35,
  )
}

function getSpanDisplayText(span: PdfTextSpan): string {
  if (!state) return span.text
  const edit = state.textEdits.find((e) => e.id === span.id)
  return edit?.text ?? span.text
}

function upsertTextEdit(span: PdfTextSpan, newText: string): void {
  if (!state) return
  const trimmed = newText.trim()
  if (trimmed === span.text) {
    state.textEdits = state.textEdits.filter((e) => e.id !== span.id)
    return
  }
  const existing = state.textEdits.find((e) => e.id === span.id)
  const record: PdfTextEdit = {
    id: span.id,
    pageIndex: activePageIndex,
    x: span.x,
    y: span.y,
    width: span.width,
    height: span.height,
    originalText: span.text,
    text: trimmed,
    fontSize: span.fontSize,
  }
  if (existing) {
    Object.assign(existing, record)
  } else {
    state.textEdits.push(record)
  }
}

async function ensurePageSpans(): Promise<PdfTextSpan[]> {
  if (!state) return []
  if (!spansByPage.has(activePageIndex)) {
    const spans = await extractPageTextSpans(
      state.sourceBytes,
      state.pages[activePageIndex],
    )
    spansByPage.set(activePageIndex, spans)
  }
  return spansByPage.get(activePageIndex) ?? []
}

async function drawPdfTextOverlays(container: HTMLElement): Promise<void> {
  if (!state || !renderMeta) return
  const layer = container.querySelector('#pdf-text-layer') as HTMLElement
  const { width, height, pdfWidth, pdfHeight } = renderMeta
  layer.style.width = `${width}px`
  layer.style.height = `${height}px`
  layer.innerHTML = ''

  const showLayer = toolMode === 'select' && state.pages[activePageIndex].type === 'original'
  layer.hidden = !showLayer
  if (!showLayer) return

  const spans = await ensurePageSpans()
  if (spans.length === 0) return

  for (const span of spans) {
    const left = (span.x / pdfWidth) * width
    const top = height - ((span.y + span.height) / pdfHeight) * height
    const w = (span.width / pdfWidth) * width
    const h = (span.height / pdfHeight) * height
    const fontPx = (span.fontSize / pdfHeight) * height

    const el = document.createElement('div')
    el.className = 'pdf-text-edit'
    el.contentEditable = 'true'
    el.spellcheck = false
    el.style.left = `${left}px`
    el.style.top = `${top}px`
    el.style.width = `${Math.max(w, 24)}px`
    el.style.minHeight = `${Math.max(h, fontPx * 1.2)}px`
    el.style.fontSize = `${fontPx}px`
    el.textContent = getSpanDisplayText(span)

    el.addEventListener('mousedown', (e) => e.stopPropagation())
    el.addEventListener('click', (e) => e.stopPropagation())
    el.addEventListener('focus', () => {
      el.classList.add('focused')
      selectedAnnotationId = null
    })
    el.addEventListener('blur', () => {
      el.classList.remove('focused')
      upsertTextEdit(span, el.textContent ?? '')
    })
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        el.blur()
      }
    })

    layer.appendChild(el)
  }
}

function drawAnnotationOverlays(container: HTMLElement): void {
  if (!state || !renderMeta) return
  const layer = container.querySelector('#annotation-layer') as HTMLElement
  const { width, height, pdfWidth, pdfHeight } = renderMeta
  layer.style.width = `${width}px`
  layer.style.height = `${height}px`
  layer.innerHTML = ''

  for (const ann of state.annotations) {
    if (ann.pageIndex !== activePageIndex) continue
    const el = document.createElement('div')
    el.className = `ann-overlay ann-${ann.type}${ann.id === selectedAnnotationId ? ' selected' : ''}`
    el.dataset.id = ann.id

    if (ann.type === 'text') {
      const left = (ann.x / pdfWidth) * width
      const top = height - (ann.y / pdfHeight) * height - ann.fontSize
      el.style.left = `${left}px`
      el.style.top = `${top}px`
      el.style.fontSize = `${ann.fontSize}px`
      el.textContent = ann.text
    } else if (ann.type === 'whiteout') {
      const left = (ann.x / pdfWidth) * width
      const top = height - ((ann.y + ann.height) / pdfHeight) * height
      const w = (ann.width / pdfWidth) * width
      const h = (ann.height / pdfHeight) * height
      el.style.left = `${left}px`
      el.style.top = `${top}px`
      el.style.width = `${w}px`
      el.style.height = `${h}px`
    } else if (ann.type === 'image') {
      const left = (ann.x / pdfWidth) * width
      const top = height - ((ann.y + ann.height) / pdfHeight) * height
      const w = (ann.width / pdfWidth) * width
      const h = (ann.height / pdfHeight) * height
      el.style.left = `${left}px`
      el.style.top = `${top}px`
      el.style.width = `${w}px`
      el.style.height = `${h}px`
      const img = document.createElement('img')
      const blob = new Blob([ann.bytes as BlobPart], { type: ann.mime })
      img.src = URL.createObjectURL(blob)
      el.appendChild(img)
    }

    if (ann.type === 'image' || ann.type === 'text') {
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        if (toolMode === 'select') {
          selectedAnnotationId = ann.id
          drawAnnotationOverlays(container)
        }
      })
    }

    layer.appendChild(el)
  }
}

function setupCanvasInteraction(container: HTMLElement): void {
  const wrap = container.querySelector('#canvas-wrap') as HTMLElement
  const canvas = container.querySelector('#page-canvas') as HTMLCanvasElement

  wrap.addEventListener('mousedown', (e) => {
    if (!state || !renderMeta) return
    const rect = canvas.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const pdf = canvasToPdfCoords(
      cx,
      cy,
      renderMeta.width,
      renderMeta.height,
      renderMeta.pdfWidth,
      renderMeta.pdfHeight,
    )

    if (toolMode === 'text') {
      const text = prompt('Enter text:')
      if (!text?.trim()) return
      state.annotations.push({
        id: newId(),
        type: 'text',
        pageIndex: activePageIndex,
        x: pdf.x,
        y: pdf.y,
        text: text.trim(),
        fontSize: 14,
      })
      refreshEditor(container)
      return
    }

    if (toolMode === 'image' && pendingImageBytes) {
      const w = 120
      const h = 80
      state.annotations.push({
        id: newId(),
        type: 'image',
        pageIndex: activePageIndex,
        x: pdf.x,
        y: pdf.y - h,
        width: w,
        height: h,
        bytes: pendingImageBytes.bytes,
        mime: pendingImageBytes.mime,
      })
      pendingImageBytes = null
      updateToolHint(container)
      refreshEditor(container)
      return
    }

    if (toolMode === 'whiteout') {
      whiteoutStart = { x: cx, y: cy }
    }
  })

  wrap.addEventListener('mousemove', (e) => {
    if (!whiteoutStart || !state || !renderMeta) return
    const rect = canvas.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const layer = container.querySelector('#annotation-layer') as HTMLElement
    let preview = layer.querySelector('.whiteout-preview') as HTMLElement
    if (!preview) {
      preview = document.createElement('div')
      preview.className = 'ann-overlay ann-whiteout whiteout-preview'
      layer.appendChild(preview)
    }
    const x = Math.min(whiteoutStart.x, cx)
    const y = Math.min(whiteoutStart.y, cy)
    const w = Math.abs(cx - whiteoutStart.x)
    const h = Math.abs(cy - whiteoutStart.y)
    preview.style.left = `${x}px`
    preview.style.top = `${y}px`
    preview.style.width = `${w}px`
    preview.style.height = `${h}px`
  })

  wrap.addEventListener('mouseup', (e) => {
    if (!whiteoutStart || !state || !renderMeta) return
    const rect = canvas.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const x1 = Math.min(whiteoutStart.x, cx)
    const y1 = Math.min(whiteoutStart.y, cy)
    const w = Math.abs(cx - whiteoutStart.x)
    const h = Math.abs(cy - whiteoutStart.y)
    whiteoutStart = null
    layerRemovePreview(container)

    if (w < 4 || h < 4) return

    const topLeft = canvasToPdfCoords(
      x1,
      y1,
      renderMeta.width,
      renderMeta.height,
      renderMeta.pdfWidth,
      renderMeta.pdfHeight,
    )
    const bottomRight = canvasToPdfCoords(
      x1 + w,
      y1 + h,
      renderMeta.width,
      renderMeta.height,
      renderMeta.pdfWidth,
      renderMeta.pdfHeight,
    )

    const replacementText = prompt('Replacement text (optional):') ?? undefined

    state.annotations.push({
      id: newId(),
      type: 'whiteout',
      pageIndex: activePageIndex,
      x: topLeft.x,
      y: bottomRight.y,
      width: bottomRight.x - topLeft.x,
      height: topLeft.y - bottomRight.y,
      replacementText: replacementText?.trim() || undefined,
      fontSize: 12,
    })
    refreshEditor(container)
  })

  // Image tool: open picker when selecting tool
  container.querySelector('[data-tool="image"]')?.addEventListener('click', () => {
    const input = container.querySelector('#image-input') as HTMLInputElement
    if (!pendingImageBytes) input.click()
  })

  // Drag to move selected image
  let drag: { id: string; startX: number; startY: number; origX: number; origY: number } | null =
    null

  wrap.addEventListener('mousedown', (e) => {
    if (toolMode !== 'select' || !selectedAnnotationId || !state || !renderMeta) return
    const ann = state.annotations.find((a) => a.id === selectedAnnotationId)
    if (!ann || ann.type !== 'image') return
    drag = {
      id: ann.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: ann.x,
      origY: ann.y,
    }
    e.preventDefault()
  })

  window.addEventListener('mousemove', (e) => {
    if (!drag || !state || !renderMeta) return
    const ann = state.annotations.find((a) => a.id === drag!.id) as ImageAnnotation | undefined
    if (!ann || ann.type !== 'image') return
    const dx = ((e.clientX - drag.startX) / renderMeta.width) * renderMeta.pdfWidth
    const dy = -((e.clientY - drag.startY) / renderMeta.height) * renderMeta.pdfHeight
    ann.x = drag.origX + dx
    ann.y = drag.origY + dy
    drawAnnotationOverlays(container)
  })

  window.addEventListener('mouseup', () => {
    drag = null
  })
}

function layerRemovePreview(container: HTMLElement): void {
  container.querySelector('.whiteout-preview')?.remove()
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
