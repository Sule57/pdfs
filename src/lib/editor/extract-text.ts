import { Util } from 'pdfjs-dist'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import { getPdfDocument } from './render-page'
import type { PageRef } from './types'
import { newId } from './types'

export interface PdfTextSpan {
  id: string
  text: string
  /** PDF points, bottom-left of bounding box */
  x: number
  y: number
  width: number
  height: number
  fontSize: number
}

interface RawItem {
  str: string
  x: number
  y: number
  width: number
  fontSize: number
}

/** Extract editable text lines from an original PDF page (not blank pages). */
export async function extractPageTextSpans(
  sourceBytes: Uint8Array,
  pageRef: PageRef,
): Promise<PdfTextSpan[]> {
  if (pageRef.type === 'blank') return []

  const doc = await getPdfDocument(sourceBytes)
  const page = await doc.getPage(pageRef.sourceIndex + 1)
  const viewport = page.getViewport({ scale: 1 })
  const textContent = await page.getTextContent()

  const raw: RawItem[] = []
  for (const item of textContent.items) {
    if (!('str' in item)) continue
    const textItem = item as TextItem
    const str = textItem.str
    if (!str.trim()) continue

    const transform = Util.transform(viewport.transform, textItem.transform)
    const fontSize = Math.hypot(transform[2], transform[3])
    const x = transform[4]
    const baselineY = transform[5]
    const width = textItem.width > 0 ? textItem.width : fontSize * str.length * 0.55

    raw.push({
      str,
      x,
      y: baselineY - fontSize * 0.85,
      width,
      fontSize,
    })
  }

  if (raw.length === 0) return []

  raw.sort((a, b) => b.y - a.y || a.x - b.x)

  const lines: RawItem[][] = []
  for (const item of raw) {
    const line = lines.find(
      (group) =>
        group.length > 0 &&
        Math.abs(group[0].y - item.y) < group[0].fontSize * 0.6,
    )
    if (line) line.push(item)
    else lines.push([item])
  }

  const spans: PdfTextSpan[] = []
  for (const group of lines) {
    group.sort((a, b) => a.x - b.x)
    let text = ''
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    let fontSize = group[0].fontSize

    for (let i = 0; i < group.length; i++) {
      const item = group[i]
      if (i > 0) {
        const prev = group[i - 1]
        const gap = item.x - (prev.x + prev.width)
        if (gap > prev.fontSize * 0.35) text += ' '
      }
      text += item.str
      minX = Math.min(minX, item.x)
      minY = Math.min(minY, item.y)
      maxX = Math.max(maxX, item.x + item.width)
      maxY = Math.max(maxY, item.y + item.fontSize)
      fontSize = Math.max(fontSize, item.fontSize)
    }

    const trimmed = text.trim()
    if (!trimmed) continue

    const pad = fontSize * 0.15
    spans.push({
      id: newId(),
      text: trimmed,
      x: minX - pad,
      y: minY - pad,
      width: maxX - minX + pad * 2,
      height: maxY - minY + pad * 2,
      fontSize,
    })
  }

  return spans
}
