const MAX_PDF_BYTES = 50 * 1024 * 1024
const MAX_MD_BYTES = 5 * 1024 * 1024

export function validatePdfFile(file: File): string | null {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return 'Only PDF files are supported.'
  }
  if (file.size > MAX_PDF_BYTES) {
    return 'File exceeds 50MB limit.'
  }
  return null
}

export function validateMdFile(file: File): string | null {
  const name = file.name.toLowerCase()
  if (!name.endsWith('.md') && !name.endsWith('.markdown')) {
    return 'Only .md or .markdown files are supported.'
  }
  if (file.size > MAX_MD_BYTES) {
    return 'File exceeds 5MB limit.'
  }
  return null
}
