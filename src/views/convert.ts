import {
  convertWordToPdf,
  conversionStartErrorMessage,
  validateWordFile,
  isWordFile,
} from '../lib/converter'
import {
  downloadBlob,
  downloadZip,
  formatBytes,
  pdfFilenameFromWord,
} from '../lib/download'
import type { WasmLoadProgress } from '@matbee/libreoffice-converter/browser'

type ItemStatus = 'waiting' | 'preparing' | 'converting' | 'done' | 'error'

interface ConvertItem {
  id: string
  file: File
  status: ItemStatus
  error?: string
  pdfData?: Uint8Array
  pdfName?: string
}

let items: ConvertItem[] = []

function uid(): string {
  return crypto.randomUUID()
}

function statusLabel(status: ItemStatus): string {
  switch (status) {
    case 'done':
      return 'Ready'
    case 'error':
      return 'Failed'
    case 'converting':
      return 'Converting…'
    case 'preparing':
      return 'Preparing…'
    default:
      return 'Waiting'
  }
}

function statusClass(status: ItemStatus): string {
  switch (status) {
    case 'done':
      return 'status-done'
    case 'error':
      return 'status-error'
    case 'converting':
    case 'preparing':
      return 'status-converting'
    default:
      return 'status-waiting'
  }
}

function friendlyError(err: unknown): string {
  if (err instanceof Error) {
    if (err.message.includes('cross-origin') || err.message.includes('SharedArrayBuffer')) {
      return conversionStartErrorMessage()
    }
    return err.message
  }
  return 'Conversion failed'
}

export function renderConvert(container: HTMLElement): void {
  items = []

  container.innerHTML = `
    <header class="site-header">
      <a href="#/" class="back-link">← Back</a>
      <span class="site-logo">Word <span>to PDF</span></span>
    </header>
    <h1 class="page-title">Word to PDF</h1>
    <p class="page-subtitle">Upload .doc or .docx files. Conversion runs locally with LibreOffice WASM.</p>
    <div class="alert alert-warning" id="mobile-hint" hidden>
      Large documents may be slow on mobile devices. A desktop browser is recommended for conversion.
    </div>
    <div class="progress-panel" id="engine-panel" hidden>
      <p id="engine-message">Loading conversion engine…</p>
      <div class="progress-bar"><div class="progress-fill" id="engine-progress" style="width: 0%"></div></div>
    </div>
    <div class="drop-zone" id="convert-drop" role="button" tabindex="0">
      <input type="file" id="convert-input" accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple />
      <div class="drop-zone-icon" aria-hidden="true">↑</div>
      <p>Drop Word documents here or click to browse</p>
      <p class="hint">Multiple files supported · max 25MB each · first visit downloads ~200MB engine (cached afterward)</p>
    </div>
    <ul class="file-list" id="convert-list"></ul>
    <div id="convert-empty" class="empty-state">No documents added yet.</div>
    <div class="btn-group">
      <button type="button" class="btn btn-primary" id="convert-start" disabled>Convert all</button>
      <button type="button" class="btn btn-secondary" id="convert-zip" disabled>Download all as ZIP</button>
      <button type="button" class="btn btn-secondary" id="convert-clear" disabled>Clear all</button>
    </div>
    <div id="convert-error" class="alert alert-error" hidden></div>
  `

  if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
    const hint = container.querySelector('#mobile-hint') as HTMLElement
    hint.hidden = false
  }

  const drop = container.querySelector('#convert-drop') as HTMLElement
  const input = container.querySelector('#convert-input') as HTMLInputElement
  const list = container.querySelector('#convert-list') as HTMLUListElement
  const empty = container.querySelector('#convert-empty') as HTMLElement
  const startBtn = container.querySelector('#convert-start') as HTMLButtonElement
  const zipBtn = container.querySelector('#convert-zip') as HTMLButtonElement
  const clearBtn = container.querySelector('#convert-clear') as HTMLButtonElement
  const errorEl = container.querySelector('#convert-error') as HTMLElement
  const enginePanel = container.querySelector('#engine-panel') as HTMLElement
  const engineMessage = container.querySelector('#engine-message') as HTMLElement
  const engineProgress = container.querySelector('#engine-progress') as HTMLElement

  const showError = (msg: string) => {
    errorEl.textContent = msg
    errorEl.hidden = !msg
  }

  const updateButtons = () => {
    const hasItems = items.length > 0
    const hasWaiting = items.some((i) => i.status === 'waiting')
    const hasDone = items.some((i) => i.status === 'done' && i.pdfData)
    const busy = items.some(
      (i) => i.status === 'converting' || i.status === 'preparing',
    )

    empty.hidden = hasItems
    list.hidden = !hasItems
    startBtn.disabled = !hasWaiting || busy
    zipBtn.disabled = !hasDone
    clearBtn.disabled = !hasItems || busy
  }

  const onEngineProgress = (info: WasmLoadProgress) => {
    enginePanel.hidden = false
    engineMessage.textContent = info.message || 'Loading conversion engine…'
    engineProgress.style.width = `${Math.min(100, info.percent)}%`
    if (info.phase === 'ready' || info.percent >= 100) {
      setTimeout(() => {
        enginePanel.hidden = true
      }, 800)
    }
  }

  const renderList = () => {
    list.innerHTML = ''
    for (const item of items) {
      const li = document.createElement('li')
      li.className = 'file-item'

      li.innerHTML = `
        <div class="file-info">
          <div class="file-name">${escapeHtml(item.file.name)}</div>
          <div class="file-meta">${formatBytes(item.file.size)}${item.error ? ` · ${escapeHtml(item.error)}` : ''}</div>
        </div>
        <span class="file-status ${statusClass(item.status)}">${statusLabel(item.status)}</span>
        <div class="file-actions">
          ${
            item.status === 'done' && item.pdfData
              ? `<button type="button" class="btn btn-secondary btn-download" data-id="${item.id}">Download</button>`
              : ''
          }
        </div>
      `
      li.querySelector('.btn-download')?.addEventListener('click', () => {
        if (item.pdfData && item.pdfName) {
          downloadBlob(item.pdfData, item.pdfName)
        }
      })
      list.appendChild(li)
    }
    updateButtons()
  }

  const addFiles = (files: FileList | File[]) => {
    showError('')
    for (const file of Array.from(files)) {
      if (!isWordFile(file)) {
        showError('Skipped non-Word files. Only .doc and .docx are supported.')
        continue
      }
      const err = validateWordFile(file)
      if (err) {
        showError(err)
        continue
      }
      items.push({ id: uid(), file, status: 'waiting' })
    }
    renderList()
  }

  drop.addEventListener('click', () => input.click())
  drop.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      input.click()
    }
  })
  input.addEventListener('change', () => {
    if (input.files?.length) addFiles(input.files)
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
    if (e.dataTransfer?.files.length) addFiles(e.dataTransfer.files)
  })

  clearBtn.addEventListener('click', () => {
    items = []
    showError('')
    renderList()
  })

  zipBtn.addEventListener('click', async () => {
    const done = items.filter((i) => i.status === 'done' && i.pdfData && i.pdfName)
    if (done.length === 0) return
    zipBtn.disabled = true
    try {
      await downloadZip(
        done.map((i) => ({ name: i.pdfName!, data: i.pdfData! })),
      )
    } catch (err) {
      showError(friendlyError(err))
    } finally {
      updateButtons()
    }
  })

  startBtn.addEventListener('click', async () => {
    showError('')
    startBtn.disabled = true
    startBtn.textContent = 'Converting…'

    for (const item of items) {
      if (item.status !== 'waiting') continue

      item.status = 'preparing'
      item.error = undefined
      renderList()

      try {
        item.status = 'converting'
        renderList()

        const result = await convertWordToPdf(item.file, onEngineProgress)
        item.pdfData = result.data
        item.pdfName = pdfFilenameFromWord(item.file.name)
        item.status = 'done'
      } catch (err) {
        item.status = 'error'
        item.error = friendlyError(err)
      }
      renderList()
    }

    startBtn.textContent = 'Convert all'
    updateButtons()
  })

  updateButtons()
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
