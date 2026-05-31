import * as pdfjsLib from 'pdfjs-dist'
import type { PageRef } from './types'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

let pdfDocCache: { bytes: Uint8Array; doc: pdfjsLib.PDFDocumentProxy } | null =
  null

export async function getPdfDocument(
  bytes: Uint8Array,
): Promise<pdfjsLib.PDFDocumentProxy> {
  if (pdfDocCache && pdfDocCache.bytes === bytes) {
    return pdfDocCache.doc
  }
  const loadingTask = pdfjsLib.getDocument({ data: bytes.slice() })
  const doc = await loadingTask.promise
  pdfDocCache = { bytes, doc }
  return doc
}

export function clearPdfRenderCache(): void {
  if (pdfDocCache) {
    void pdfDocCache.doc.destroy()
    pdfDocCache = null
  }
}

export interface RenderResult {
  width: number
  height: number
  pdfWidth: number
  pdfHeight: number
}

/** Render a page to canvas; returns PDF page dimensions in points. */
export async function renderPageToCanvas(
  sourceBytes: Uint8Array,
  pageRef: PageRef,
  canvas: HTMLCanvasElement,
  scale = 1.25,
): Promise<RenderResult> {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')

  if (pageRef.type === 'blank') {
    const pdfWidth = 595.28
    const pdfHeight = 841.89
    const width = Math.floor(pdfWidth * scale)
    const height = Math.floor(pdfHeight * scale)
    canvas.width = width
    canvas.height = height
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.strokeStyle = '#e0e0e0'
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1)
    return { width, height, pdfWidth, pdfHeight }
  }

  const doc = await getPdfDocument(sourceBytes)
  const page = await doc.getPage(pageRef.sourceIndex + 1)
  const viewport = page.getViewport({ scale })
  canvas.width = viewport.width
  canvas.height = viewport.height
  await page.render({ canvasContext: ctx, viewport, canvas }).promise

  const pdfWidth = viewport.width / scale
  const pdfHeight = viewport.height / scale
  return {
    width: viewport.width,
    height: viewport.height,
    pdfWidth,
    pdfHeight,
  }
}

export async function renderThumbnail(
  sourceBytes: Uint8Array,
  pageRef: PageRef,
  canvas: HTMLCanvasElement,
  maxWidth = 120,
): Promise<void> {
  if (pageRef.type === 'blank') {
    const pdfWidth = 595.28
    const scale = maxWidth / pdfWidth
    await renderPageToCanvas(
      sourceBytes,
      pageRef,
      canvas,
      scale,
    )
    return
  }

  const doc = await getPdfDocument(sourceBytes)
  const page = await doc.getPage(pageRef.sourceIndex + 1)
  const base = page.getViewport({ scale: 1 })
  const scale = maxWidth / base.width
  await renderPageToCanvas(sourceBytes, pageRef, canvas, scale)
}

/** Map canvas pixel coords to PDF points (bottom-left origin). */
export function canvasToPdfCoords(
  canvasX: number,
  canvasY: number,
  canvasWidth: number,
  canvasHeight: number,
  pdfWidth: number,
  pdfHeight: number,
): { x: number; y: number } {
  const x = (canvasX / canvasWidth) * pdfWidth
  const y = pdfHeight - (canvasY / canvasHeight) * pdfHeight
  return { x, y }
}
