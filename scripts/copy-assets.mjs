import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkgRoot = path.join(root, 'node_modules', '@matbee', 'libreoffice-converter')
const wasmSrc = path.join(pkgRoot, 'wasm')
const wasmDest = path.join(root, 'public', 'wasm')
const workerSrc = path.join(pkgRoot, 'dist', 'browser.worker.global.js')
const workerDest = path.join(root, 'public', 'dist', 'browser.worker.global.js')

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(src, dest)
}

function copyWasmDir() {
  if (!fs.existsSync(wasmSrc)) {
    console.warn('LibreOffice WASM not found; run npm install first.')
    return
  }
  fs.mkdirSync(wasmDest, { recursive: true })
  for (const name of fs.readdirSync(wasmSrc)) {
    const srcPath = path.join(wasmSrc, name)
    if (!fs.statSync(srcPath).isFile()) continue
    copyFile(srcPath, path.join(wasmDest, name))
  }
}

copyWasmDir()
copyFile(workerSrc, workerDest)
console.log('Copied LibreOffice WASM assets to public/')
