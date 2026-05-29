import mammoth from 'mammoth'
import { jsPDF } from 'jspdf'
import type { ConversionResult } from '@matbee/libreoffice-converter/browser'

/**
 * DOCX → PDF without LibreOffice WASM (no cross-origin isolation required).
 * Layout fidelity is lower than WASM; .doc is not supported on this path.
 */
export async function convertDocxFallback(file: File): Promise<ConversionResult> {
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.doc') && !lower.endsWith('.docx')) {
    throw new Error(
      'Legacy .doc files need full-quality mode. Save as .docx, or ask the site owner to enable cross-origin headers on the server.',
    )
  }
  if (!lower.endsWith('.docx')) {
    throw new Error('Only .doc and .docx files are supported.')
  }

  const start = performance.now()
  const arrayBuffer = await file.arrayBuffer()
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer })

  const wrapped = `<div style="font-family: Helvetica, Arial, sans-serif; font-size: 12pt; line-height: 1.45; color: #111;">${html}</div>`

  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })
  const pageWidth = doc.internal.pageSize.getWidth()

  await doc.html(wrapped, {
    x: 0,
    y: 0,
    width: pageWidth,
    windowWidth: 794,
    autoPaging: 'text',
    margin: [36, 36, 36, 36],
  })

  const data = new Uint8Array(doc.output('arraybuffer'))
  const base = file.name.replace(/\.[^.]+$/, '')

  return {
    data,
    mimeType: 'application/pdf',
    filename: `${base}.pdf`,
    duration: Math.round(performance.now() - start),
  }
}
