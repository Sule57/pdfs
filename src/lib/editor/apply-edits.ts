import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFPage,
} from 'pdf-lib'
import type { Annotation, EditorState, ImageAnnotation } from './types'

const A4: [number, number] = [595.28, 841.89]

async function embedImage(
  doc: PDFDocument,
  ann: ImageAnnotation,
): Promise<{ img: Awaited<ReturnType<PDFDocument['embedPng']>>; scale: number }> {
  if (ann.mime === 'image/png') {
    const img = await doc.embedPng(ann.bytes)
    return { img, scale: 1 }
  }
  const img = await doc.embedJpg(ann.bytes)
  return { img, scale: 1 }
}

function applyAnnotations(
  page: PDFPage,
  annotations: Annotation[],
  pageIndex: number,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
): void {
  for (const ann of annotations) {
    if (ann.pageIndex !== pageIndex) continue

    if (ann.type === 'whiteout') {
      page.drawRectangle({
        x: ann.x,
        y: ann.y,
        width: ann.width,
        height: ann.height,
        color: rgb(1, 1, 1),
        borderWidth: 0,
      })
      if (ann.replacementText) {
        page.drawText(ann.replacementText, {
          x: ann.x + 4,
          y: ann.y + ann.height / 2 - (ann.fontSize ?? 12) / 2,
          size: ann.fontSize ?? 12,
          font,
          color: rgb(0, 0, 0),
        })
      }
    } else if (ann.type === 'text') {
      page.drawText(ann.text, {
        x: ann.x,
        y: ann.y,
        size: ann.fontSize,
        font,
        color: rgb(0, 0, 0),
      })
    }
  }
}

export async function exportEditedPdf(state: EditorState): Promise<Uint8Array> {
  const source = await PDFDocument.load(state.sourceBytes, {
    ignoreEncryption: true,
  })
  const out = await PDFDocument.create()
  const font = await out.embedFont(StandardFonts.Helvetica)
  const imageCache = new Map<string, Awaited<ReturnType<PDFDocument['embedPng']>>>()

  for (let displayIndex = 0; displayIndex < state.pages.length; displayIndex++) {
    const ref = state.pages[displayIndex]
    let page: PDFPage

    if (ref.type === 'blank') {
      page = out.addPage(A4)
    } else {
      const [copied] = await out.copyPages(source, [ref.sourceIndex])
      out.addPage(copied)
      page = out.getPage(out.getPageCount() - 1)
    }

    applyAnnotations(page, state.annotations, displayIndex, font)

    for (const ann of state.annotations) {
      if (ann.pageIndex !== displayIndex || ann.type !== 'image') continue
      const cacheKey = ann.id
      let img = imageCache.get(cacheKey)
      if (!img) {
        const embedded = await embedImage(out, ann)
        img = embedded.img
        imageCache.set(cacheKey, img)
      }
      page.drawImage(img, {
        x: ann.x,
        y: ann.y,
        width: ann.width,
        height: ann.height,
      })
    }
  }

  return out.save()
}
