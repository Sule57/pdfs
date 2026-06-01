import html2pdf from 'html2pdf.js'

export async function exportPreviewToPdf(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  await html2pdf()
    .set({
      margin: 10,
      filename,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    })
    .from(element)
    .save()
}

export function mdPdfFilename(sourceName: string | null): string {
  if (!sourceName) return 'document.pdf'
  const base = sourceName.replace(/\.md$/i, '')
  return `${base || 'document'}.pdf`
}
