import { mergePdfs, getPdfPageCount } from '../lib/merge-pdf'
import { downloadBlob, formatBytes } from '../lib/download'
import { validatePdfFile } from '../lib/converter'

interface MergeItem {
  id: string
  file: File
  bytes: Uint8Array
  pageCount: number | null
}

let items: MergeItem[] = []
let dragId: string | null = null

function uid(): string {
  return crypto.randomUUID()
}

export function renderMerge(container: HTMLElement): void {
  items = []

  container.innerHTML = `
    <header class="site-header">
      <a href="#/" class="back-link">← Back</a>
      <span class="site-logo">Combine <span>PDFs</span></span>
    </header>
    <h1 class="page-title">Combine PDFs</h1>
    <p class="page-subtitle">Upload PDFs, drag to reorder, then download the merged document.</p>
    <div class="drop-zone" id="merge-drop" role="button" tabindex="0">
      <input type="file" id="merge-input" accept=".pdf,application/pdf" multiple />
      <div class="drop-zone-icon" aria-hidden="true">↑</div>
      <p>Drop PDFs here or click to browse</p>
      <p class="hint">You can add more files after the first upload</p>
    </div>
    <ul class="file-list" id="merge-list"></ul>
    <div id="merge-empty" class="empty-state">No PDFs added yet.</div>
    <div class="btn-group">
      <button type="button" class="btn btn-primary" id="merge-combine" disabled>Combine & download</button>
      <button type="button" class="btn btn-secondary" id="merge-clear" disabled>Clear all</button>
    </div>
    <div id="merge-error" class="alert alert-error" hidden></div>
  `

  const drop = container.querySelector('#merge-drop') as HTMLElement
  const input = container.querySelector('#merge-input') as HTMLInputElement
  const list = container.querySelector('#merge-list') as HTMLUListElement
  const empty = container.querySelector('#merge-empty') as HTMLElement
  const combineBtn = container.querySelector('#merge-combine') as HTMLButtonElement
  const clearBtn = container.querySelector('#merge-clear') as HTMLButtonElement
  const errorEl = container.querySelector('#merge-error') as HTMLElement

  const showError = (msg: string) => {
    errorEl.textContent = msg
    errorEl.hidden = !msg
  }

  const refreshUi = () => {
    const hasItems = items.length > 0
    empty.hidden = hasItems
    list.hidden = !hasItems
    combineBtn.disabled = !hasItems
    clearBtn.disabled = !hasItems
    renderList(list)
  }

  const addFiles = async (files: FileList | File[]) => {
    showError('')
    for (const file of Array.from(files)) {
      const err = validatePdfFile(file)
      if (err) {
        showError(err)
        continue
      }
      const bytes = new Uint8Array(await file.arrayBuffer())
      let pageCount: number | null = null
      try {
        pageCount = await getPdfPageCount(bytes)
      } catch {
        pageCount = null
      }
      items.push({ id: uid(), file, bytes, pageCount })
    }
    refreshUi()
  }

  drop.addEventListener('click', () => input.click())
  drop.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      input.click()
    }
  })

  input.addEventListener('change', () => {
    if (input.files?.length) void addFiles(input.files)
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
    if (e.dataTransfer?.files.length) void addFiles(e.dataTransfer.files)
  })

  clearBtn.addEventListener('click', () => {
    items = []
    showError('')
    refreshUi()
  })

  combineBtn.addEventListener('click', async () => {
    if (items.length === 0) return
    combineBtn.disabled = true
    combineBtn.textContent = 'Merging…'
    showError('')
    try {
      const merged = await mergePdfs(
        items.map((i) => ({ bytes: i.bytes, name: i.file.name })),
      )
      downloadBlob(merged, 'combined.pdf')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to merge PDFs.')
    } finally {
      combineBtn.disabled = items.length === 0
      combineBtn.textContent = 'Combine & download'
    }
  })

  refreshUi()
}

function renderList(list: HTMLUListElement): void {
  list.innerHTML = ''
  items.forEach((item, index) => {
    const li = document.createElement('li')
    li.className = 'file-item'
    li.draggable = true
    li.dataset.id = item.id

    const pages =
      item.pageCount != null ? `${item.pageCount} page${item.pageCount === 1 ? '' : 's'}` : 'PDF'
    const meta = `${formatBytes(item.file.size)} · ${pages}`

    li.innerHTML = `
      <span class="file-drag-handle" title="Drag to reorder" aria-hidden="true">⋮⋮</span>
      <div class="file-info">
        <div class="file-name">${escapeHtml(item.file.name)}</div>
        <div class="file-meta">${meta}</div>
      </div>
      <div class="file-actions">
        <div class="order-controls">
          <button type="button" class="btn btn-ghost" data-move="up" aria-label="Move up" ${index === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" class="btn btn-ghost" data-move="down" aria-label="Move down" ${index === items.length - 1 ? 'disabled' : ''}>↓</button>
        </div>
        <button type="button" class="btn btn-ghost" data-remove aria-label="Remove">×</button>
      </div>
    `

    li.addEventListener('dragstart', () => {
      dragId = item.id
      li.classList.add('dragging')
    })
    li.addEventListener('dragend', () => {
      dragId = null
      li.classList.remove('dragging')
      list.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'))
    })
    li.addEventListener('dragover', (e) => {
      e.preventDefault()
      if (dragId && dragId !== item.id) li.classList.add('drag-over')
    })
    li.addEventListener('dragleave', () => li.classList.remove('drag-over'))
    li.addEventListener('drop', (e) => {
      e.preventDefault()
      li.classList.remove('drag-over')
      if (!dragId || dragId === item.id) return
      const from = items.findIndex((i) => i.id === dragId)
      const to = items.findIndex((i) => i.id === item.id)
      if (from < 0 || to < 0) return
      const [moved] = items.splice(from, 1)
      items.splice(to, 0, moved)
      renderList(list)
    })

    li.querySelector('[data-move="up"]')?.addEventListener('click', () => {
      if (index > 0) {
        ;[items[index - 1], items[index]] = [items[index], items[index - 1]]
        renderList(list)
      }
    })
    li.querySelector('[data-move="down"]')?.addEventListener('click', () => {
      if (index < items.length - 1) {
        ;[items[index], items[index + 1]] = [items[index + 1], items[index]]
        renderList(list)
      }
    })
    li.querySelector('[data-remove]')?.addEventListener('click', () => {
      items = items.filter((i) => i.id !== item.id)
      renderList(list)
      const empty = list.parentElement?.querySelector('#merge-empty') as HTMLElement
      const combineBtn = list.parentElement?.querySelector('#merge-combine') as HTMLButtonElement
      const clearBtn = list.parentElement?.querySelector('#merge-clear') as HTMLButtonElement
      if (empty) empty.hidden = items.length > 0
      if (combineBtn) combineBtn.disabled = items.length === 0
      if (clearBtn) clearBtn.disabled = items.length === 0
      list.hidden = items.length === 0
    })

    list.appendChild(li)
  })
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
