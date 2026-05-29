import {
  WorkerBrowserConverter,
  createWasmPaths,
  type WasmLoadProgress,
} from '@matbee/libreoffice-converter/browser'
import type { ConversionResult } from '@matbee/libreoffice-converter/browser'

const MAX_FILE_BYTES = 25 * 1024 * 1024
const WORD_EXTENSIONS = ['.doc', '.docx']
const INIT_TIMEOUT_MS = 15 * 60 * 1000

let converter: WorkerBrowserConverter | null = null
let initPromise: Promise<WorkerBrowserConverter> | null = null

export function isCrossOriginIsolated(): boolean {
  return typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated
}

export function conversionStartErrorMessage(): string {
  return 'Conversion failed. Try again or use a .docx file.'
}

export function isWordFile(file: File): boolean {
  const lower = file.name.toLowerCase()
  return WORD_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

export function validateWordFile(file: File): string | null {
  if (!isWordFile(file)) {
    return 'Only .doc and .docx files are supported.'
  }
  if (file.size > MAX_FILE_BYTES) {
    return `File exceeds ${MAX_FILE_BYTES / (1024 * 1024)}MB limit.`
  }
  return null
}

export function validatePdfFile(file: File): string | null {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return 'Only PDF files are supported.'
  }
  if (file.size > 50 * 1024 * 1024) {
    return 'File exceeds 50MB limit.'
  }
  return null
}

function wasmBase(): string {
  const base = import.meta.env.BASE_URL
  return `${base}wasm/`
}

function workerUrl(): string {
  const base = import.meta.env.BASE_URL
  return `${base}dist/browser.worker.global.js`
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((err) => {
        clearTimeout(timer)
        reject(err)
      })
  })
}

function resetInitState(): void {
  initPromise = null
  converter = null
}

async function initializeWasmConverter(
  onProgress?: (info: WasmLoadProgress) => void,
): Promise<WorkerBrowserConverter> {
  if (converter?.isReady()) {
    return converter
  }

  if (initPromise) {
    return initPromise
  }

  initPromise = (async () => {
    const instance = new WorkerBrowserConverter({
      ...createWasmPaths(wasmBase()),
      browserWorkerJs: workerUrl(),
      onProgress: (info) => onProgress?.(info),
    })
    await withTimeout(
      instance.initialize(),
      INIT_TIMEOUT_MS,
      'Conversion engine timed out. Check your connection and try again.',
    )
    converter = instance
    return instance
  })()

  try {
    return await initPromise
  } catch (error) {
    resetInitState()
    throw error
  }
}

async function convertWordToPdfWasm(
  file: File,
  onProgress?: (info: WasmLoadProgress) => void,
): Promise<ConversionResult> {
  const conv = await initializeWasmConverter(onProgress)
  const buffer = await file.arrayBuffer()
  return conv.convert(buffer, { outputFormat: 'pdf' }, file.name)
}

/** Whether the site is using the lighter DOCX converter (no WASM / isolation). */
export async function checkIsolationHeaders(): Promise<{
  isolated: boolean
  coop: string | null
  coep: string | null
}> {
  const isolated = isCrossOriginIsolated()
  let coop: string | null = null
  let coep: string | null = null
  try {
    const res = await fetch(window.location.href, { method: 'HEAD', cache: 'no-store' })
    coop = res.headers.get('cross-origin-opener-policy')
    coep = res.headers.get('cross-origin-embedder-policy')
  } catch {
    /* ignore */
  }
  return { isolated, coop, coep }
}

export async function convertWordToPdf(
  file: File,
  onProgress?: (info: WasmLoadProgress) => void,
): Promise<ConversionResult> {
  const validation = validateWordFile(file)
  if (validation) {
    throw new Error(validation)
  }

  if (isCrossOriginIsolated()) {
    return convertWordToPdfWasm(file, onProgress)
  }

  const { convertDocxFallback } = await import('./convert-fallback')
  return convertDocxFallback(file)
}

export async function destroyConverter(): Promise<void> {
  if (converter) {
    await converter.destroy()
    converter = null
  }
  initPromise = null
}
