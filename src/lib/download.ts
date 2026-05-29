export function downloadBlob(
  data: Uint8Array,
  filename: string,
  mime = 'application/pdf',
): void {
  const blob = new Blob([data as BlobPart], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function pdfFilenameFromWord(name: string): string {
  const base = name.replace(/\.[^.]+$/, '')
  return `${base}.pdf`
}

export async function downloadZip(
  files: { name: string; data: Uint8Array }[],
  zipName = 'converted-pdfs.zip',
): Promise<void> {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  for (const file of files) {
    zip.file(file.name, file.data)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  const bytes = new Uint8Array(await blob.arrayBuffer())
  downloadBlob(bytes, zipName, 'application/zip')
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
