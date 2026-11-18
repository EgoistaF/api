"use client"

import { parseBulkImport, type ParsedPair } from "./text"

export type OcrProgress = { stage: string; percent: number }

type OcrWord = { text: string; x0: number; x1: number; confidence: number }
type OcrLine = { words: OcrWord[]; text: string; confidence: number }

const STAGE_LABELS: Record<string, string> = {
  "loading tesseract core": "Загрузка движка",
  "initializing tesseract": "Запуск движка",
  "loading language traineddata": "Загрузка языков",
  "initializing api": "Подготовка",
  "recognizing text": "Распознавание",
}

/** Everything is served from this origin, so recognition works without a CDN. */
const WORKER_OPTIONS = {
  workerPath: "/tesseract/worker.min.js",
  corePath: "/tesseract",
  langPath: "/tessdata",
}

function collectLines(data: unknown): OcrLine[] {
  const lines: OcrLine[] = []
  const visit = (node: any) => {
    if (!node || typeof node !== "object") return
    if (Array.isArray(node)) {
      node.forEach(visit)
      return
    }
    if (Array.isArray(node.words) && typeof node.text === "string") {
      lines.push({
        text: node.text.trim(),
        confidence: typeof node.confidence === "number" ? node.confidence : 0,
        words: node.words
          .filter((word: any) => word?.text?.trim())
          .map((word: any) => ({
            text: String(word.text).trim(),
            x0: word.bbox?.x0 ?? word.x0 ?? 0,
            x1: word.bbox?.x1 ?? word.x1 ?? 0,
            confidence: word.confidence ?? 0,
          })),
      })
      return
    }
    for (const key of ["blocks", "paragraphs", "lines"]) visit(node[key])
  }
  visit(data)
  return lines.filter((line) => line.text)
}

/**
 * Latin and Cyrillic share identical-looking letters, so recognition happily
 * reads "окно" as "OKHO". Nothing on screen gives it away, but the card would
 * then never match what the user types. Tokens made only of look-alikes are
 * pulled back to whichever script the rest of their column uses.
 */
const LATIN_TO_CYRILLIC: Record<string, string> = {
  A: "А", B: "В", C: "С", E: "Е", H: "Н", K: "К", M: "М", O: "О", P: "Р", T: "Т", X: "Х", Y: "У",
  a: "а", c: "с", e: "е", o: "о", p: "р", x: "х", y: "у",
}
const CYRILLIC_TO_LATIN: Record<string, string> = Object.fromEntries(
  Object.entries(LATIN_TO_CYRILLIC).map(([latin, cyrillic]) => [cyrillic, latin]),
)

const CYRILLIC = /[\u0400-\u04FF]/
const LATIN = /[A-Za-z]/

function convertToken(token: string, table: Record<string, string>) {
  const letters = Array.from(token).filter((char) => /\p{L}/u.test(char))
  if (letters.length < 3) return token
  if (!letters.every((char) => table[char])) return token
  return Array.from(token)
    .map((char) => table[char] ?? char)
    .join("")
}

function dominantScript(values: string[]): "cyrillic" | "latin" | null {
  let cyrillic = 0
  let latin = 0
  for (const value of values) {
    for (const char of value) {
      if (CYRILLIC.test(char)) cyrillic++
      else if (LATIN.test(char)) latin++
    }
  }
  const total = cyrillic + latin
  if (total < 10) return null
  if (cyrillic / total > 0.7) return "cyrillic"
  if (latin / total > 0.7) return "latin"
  return null
}

/** Pulls each column back to the script the rest of that column is written in. */
export function harmonizeScripts(pairs: ParsedPair[]): ParsedPair[] {
  const termScript = dominantScript(pairs.map((pair) => pair.term))
  const defScript = dominantScript(pairs.map((pair) => pair.definition))
  const table = (script: "cyrillic" | "latin" | null) =>
    script === "cyrillic" ? LATIN_TO_CYRILLIC : script === "latin" ? CYRILLIC_TO_LATIN : null

  const fix = (value: string, script: "cyrillic" | "latin" | null) => {
    const map = table(script)
    if (!map) return value
    return value
      .split(/(\s+)/)
      .map((token) => (token.trim() ? convertToken(token, map) : token))
      .join("")
  }

  return pairs.map((pair) => ({ term: fix(pair.term, termScript), definition: fix(pair.definition, defScript) }))
}

function median(values: number[]) {
  if (!values.length) return 0
  const sorted = values.slice().sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

/**
 * Word lists are laid out in two columns, so the split is found from where the
 * words actually sit rather than from punctuation: the widest gap on each line,
 * agreed across lines. Falls back to separator parsing when there is no gap,
 * which is what a single-column screenshot looks like.
 */
export function pairsFromLines(lines: OcrLine[]): ParsedPair[] {
  const candidates: { line: OcrLine; gap: number; middle: number }[] = []
  const spaceWidths: number[] = []

  for (const line of lines) {
    if (line.words.length < 2) continue
    let best = { gap: -1, middle: 0 }
    for (let i = 0; i < line.words.length - 1; i++) {
      const gap = line.words[i + 1].x0 - line.words[i].x1
      spaceWidths.push(gap)
      if (gap > best.gap) best = { gap, middle: (line.words[i].x1 + line.words[i + 1].x0) / 2 }
    }
    if (best.gap > 0) candidates.push({ line, gap: best.gap, middle: best.middle })
  }

  const typicalSpace = median(spaceWidths.filter((value) => value > 0)) || 1
  const columnGaps = candidates.filter((item) => item.gap > typicalSpace * 3)

  if (columnGaps.length >= Math.max(2, Math.ceil(candidates.length * 0.5))) {
    const splitX = median(columnGaps.map((item) => item.middle))
    const pairs: ParsedPair[] = []
    for (const line of lines) {
      if (!line.words.length) continue
      const left = line.words.filter((word) => (word.x0 + word.x1) / 2 < splitX)
      const right = line.words.filter((word) => (word.x0 + word.x1) / 2 >= splitX)
      const term = left.map((word) => word.text).join(" ").trim()
      const definition = right.map((word) => word.text).join(" ").trim()
      if (term || definition) pairs.push({ term, definition })
    }
    return pairs
  }

  return parseBulkImport(lines.map((line) => line.text).join("\n"), "newline", "dash")
}

export async function recognizePairs(
  images: Blob[],
  onProgress?: (progress: OcrProgress) => void,
): Promise<ParsedPair[]> {
  // Loaded on demand: the engine is several megabytes and most visits never
  // need it.
  const { createWorker } = await import("tesseract.js")
  const worker = await createWorker(["deu", "rus"], 1, {
    ...WORKER_OPTIONS,
    logger: (message: { status: string; progress: number }) => {
      onProgress?.({
        stage: STAGE_LABELS[message.status] ?? message.status,
        percent: Math.round((message.progress ?? 0) * 100),
      })
    },
  })

  try {
    const all: ParsedPair[] = []
    for (let index = 0; index < images.length; index++) {
      onProgress?.({ stage: `Распознавание ${index + 1} из ${images.length}`, percent: 0 })
      const result = await worker.recognize(images[index], {}, { blocks: true, text: true })
      const lines = collectLines(result.data.blocks ?? result.data)
      const pairs = lines.length
        ? pairsFromLines(lines)
        : parseBulkImport(result.data.text ?? "", "newline", "dash")
      all.push(...pairs)
    }
    // Drop rows where recognition clearly produced noise rather than a card.
    const kept = all.filter((pair) => (pair.term + pair.definition).replace(/\s/g, "").length > 1)
    return harmonizeScripts(kept)
  } finally {
    await worker.terminate()
  }
}
