import { PDFDocument } from 'pdf-lib'

export async function getPdfPageCount(bytes: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  return doc.getPageCount()
}

export async function mergePdfs(
  files: { bytes: Uint8Array; name: string }[],
): Promise<Uint8Array> {
  const merged = await PDFDocument.create()

  for (const file of files) {
    const source = await PDFDocument.load(file.bytes, { ignoreEncryption: true })
    const indices = source.getPageIndices()
    const pages = await merged.copyPages(source, indices)
    for (const page of pages) {
      merged.addPage(page)
    }
  }

  return merged.save()
}
