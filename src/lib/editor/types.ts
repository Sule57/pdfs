export type PageRef =
  | { type: 'original'; sourceIndex: number }
  | { type: 'blank' }

export type ToolMode = 'select' | 'text' | 'image' | 'whiteout'

export interface TextAnnotation {
  id: string
  type: 'text'
  pageIndex: number
  x: number
  y: number
  text: string
  fontSize: number
}

export interface WhiteoutAnnotation {
  id: string
  type: 'whiteout'
  pageIndex: number
  x: number
  y: number
  width: number
  height: number
  replacementText?: string
  fontSize?: number
}

export interface ImageAnnotation {
  id: string
  type: 'image'
  pageIndex: number
  x: number
  y: number
  width: number
  height: number
  bytes: Uint8Array
  mime: 'image/png' | 'image/jpeg'
}

export type Annotation = TextAnnotation | WhiteoutAnnotation | ImageAnnotation

export interface EditorState {
  sourceBytes: Uint8Array
  fileName: string
  pages: PageRef[]
  annotations: Annotation[]
}

export function createEditorState(
  sourceBytes: Uint8Array,
  fileName: string,
  pageCount: number,
): EditorState {
  const pages: PageRef[] = []
  for (let i = 0; i < pageCount; i++) {
    pages.push({ type: 'original', sourceIndex: i })
  }
  return { sourceBytes, fileName, pages, annotations: [] }
}

export function newId(): string {
  return crypto.randomUUID()
}
