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

/** User-facing message when conversion cannot start. */
export function conversionStartErrorMessage(): string {
  return 'Conversion could not start. Try a hard refresh or another browser.'
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

export async function initializeConverter(
  onProgress?: (info: WasmLoadProgress) => void,
): Promise<WorkerBrowserConverter> {
  if (!isCrossOriginIsolated()) {
    if (import.meta.env.DEV) {
      console.warn(
        'crossOriginIsolated is false; Word conversion may not work until COOP/COEP headers are set.',
      )
    }
    throw new Error(conversionStartErrorMessage())
  }

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

export async function convertWordToPdf(
  file: File,
  onProgress?: (info: WasmLoadProgress) => void,
): Promise<ConversionResult> {
  const validation = validateWordFile(file)
  if (validation) {
    throw new Error(validation)
  }

  const conv = await initializeConverter(onProgress)
  const buffer = await file.arrayBuffer()
  return conv.convert(buffer, { outputFormat: 'pdf' }, file.name)
}

export async function destroyConverter(): Promise<void> {
  if (converter) {
    await converter.destroy()
    converter = null
  }
  initPromise = null
}
