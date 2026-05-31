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

export function validateImageFile(file: File): string | null {
  const t = file.type.toLowerCase()
  if (t !== 'image/png' && t !== 'image/jpeg' && t !== 'image/jpg') {
    return 'Only PNG and JPEG images are supported.'
  }
  if (file.size > 10 * 1024 * 1024) {
    return 'Image exceeds 10MB limit.'
  }
  return null
}
