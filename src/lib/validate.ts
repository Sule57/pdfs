const MAX_PDF_BYTES = 50 * 1024 * 1024

export function validatePdfFile(file: File): string | null {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return 'Only PDF files are supported.'
  }
  if (file.size > MAX_PDF_BYTES) {
    return 'File exceeds 50MB limit.'
  }
  return null
}
