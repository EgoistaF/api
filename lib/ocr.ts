"use client"

import type { ParsedPair } from "./text"

export type OcrProgress = { stage: string; percent: number }

type OcrWord = { text: string; x0: number; x1: number; y0: number; y1: number; confidence: number }
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
            y0: word.bbox?.y0 ?? word.y0 ?? 0,
            y1: word.bbox?.y1 ?? word.y1 ?? 0,
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
 *
 * Longer keys win over single letters: "ы" is read as the pair "bI" far more
 * often than as anything else.
 */
const LATIN_TO_CYRILLIC: Record<string, string> = {
  bI: "ы", bl: "ы", "6I": "ы", "6l": "ы",
  A: "А", B: "В", C: "С", E: "Е", H: "Н", K: "К", M: "М", O: "О", P: "Р", T: "Т", X: "Х", Y: "У",
  a: "а", c: "с", e: "е", o: "о", p: "р", x: "х", y: "у", b: "ь", "6": "б",
}
const CYRILLIC_TO_LATIN: Record<string, string> = Object.fromEntries(
  Object.entries(LATIN_TO_CYRILLIC)
    .filter(([latin]) => latin.length === 1 && /[A-Za-z]/.test(latin))
    .map(([latin, cyrillic]) => [cyrillic, latin]),
)

const CYRILLIC = /[\u0400-\u04FF]/
const LATIN = /[A-Za-z]/

type Script = "cyrillic" | "latin" | null

function convertToken(token: string, table: Record<string, string>) {
  const letters = Array.from(token).filter((char) => /\p{L}/u.test(char))
  if (letters.length < 3) return token
  let out = ""
  for (let i = 0; i < token.length; ) {
    const pair = token.slice(i, i + 2)
    const char = token[i]
    if (table[pair]) {
      out += table[pair]
      i += 2
    } else if (table[char]) {
      out += table[char]
      i += 1
    } else if (!/\p{L}/u.test(char)) {
      out += char
      i += 1
    } else {
      // One letter that is not a look-alike is enough: the word was read in
      // the script it is actually written in.
      return token
    }
  }
  // "мыть" read as "MbITb" comes back as "МыТь": capitals in the middle of a
  // word are a leftover of the misreading, not how the word is written.
  if (/\p{Lu}/u.test(out.slice(1))) return out.toLowerCase()
  return out
}

function dominantScript(values: string[]): Script {
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
  const table = (script: Script) =>
    script === "cyrillic" ? LATIN_TO_CYRILLIC : script === "latin" ? CYRILLIC_TO_LATIN : null

  const fix = (value: string, script: Script) => {
    const map = table(script)
    if (!map) return value
    return value
      .split(/(\s+)/)
      .map((token) => (token.trim() ? convertToken(token, map) : token))
      .join("")
  }

  return pairs.map((pair) => ({ term: fix(pair.term, termScript), definition: fix(pair.definition, defScript) }))
}

/**
 * Drops the heading a table carries over its columns: "Russisch" standing
 * where every other row has a Russian word is a label, not an answer.
 *
 * Only the top of the page is examined, and only after the look-alike
 * repair: further down, a row whose translation came out in the wrong
 * alphabet is a misreading the user can still fix by hand, and throwing it
 * away would lose the term with it.
 */
const HEADING_ROWS = 3

export function dropHeadings(pairs: ParsedPair[]): ParsedPair[] {
  if (pairs.length < 5) return pairs
  const script = dominantScript(pairs.map((pair) => pair.definition))
  if (!script) return pairs
  const answer = script === "cyrillic" ? CYRILLIC : LATIN
  const foreign = script === "cyrillic" ? LATIN : CYRILLIC
  return pairs.filter((pair, index) => {
    if (index >= HEADING_ROWS) return true
    const letters = Array.from(pair.definition).filter((char) => /\p{L}/u.test(char))
    if (letters.length < 2) return true
    return letters.some((char) => answer.test(char)) || !letters.some((char) => foreign.test(char))
  })
}

function median(values: number[]) {
  if (!values.length) return 0
  const sorted = values.slice().sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

/** How many lines have a word that reaches into [from, to]. */
function crossings(lines: OcrLine[], from: number, to: number) {
  let count = 0
  for (const line of lines) {
    if (line.words.some((word) => word.x0 < to && word.x1 > from)) count++
  }
  return count
}

/**
 * Finds the left edge of every column of a word list.
 *
 * Word lists are tables: the cells of a column start at the same x on line
 * after line, so the left edges of all words pile up at a few places. Each
 * pile with enough lines behind it is a column — provided there is a clear
 * run of whitespace in front of it, which is what separates a real column
 * from the gap after the article in "die Wohnung".
 *
 * Measuring the whitespace instead of the gaps within a line is what makes
 * this work on tables of three or four columns, where nearly every gap on a
 * line is a column gap and none of them stands out as the widest.
 */
export function detectColumns(lines: OcrLine[]): number[] | null {
  const rows = lines.filter((line) => line.words.length)
  if (rows.length < 4) return null

  const words = rows.flatMap((line) => line.words)
  const height = median(words.map((word) => word.y1 - word.y0)) || 10
  const minGutter = Math.max(height * 0.8, 10)
  const tolerance = Math.max(height * 0.5, 6)
  const support = Math.max(3, Math.ceil(rows.length * 0.4))
  // Titles and footnotes sit across the columns; a few of them must not stop
  // a gutter from counting as one.
  const allowedCrossings = Math.max(1, Math.floor(rows.length * 0.15))

  const edges = rows
    .flatMap((line, index) => line.words.map((word) => ({ x: word.x0, line: index })))
    .sort((a, b) => a.x - b.x)

  // Grouped by the step from one edge to the next, not by distance from the
  // first one: a photo taken at a slight angle walks a column sideways across
  // the page, and the pile has to walk with it.
  const piles: { xs: number[]; lines: Set<number> }[] = []
  for (const edge of edges) {
    const last = piles[piles.length - 1]
    const previous = last?.xs[last.xs.length - 1] ?? 0
    if (last && edge.x - previous <= tolerance && edge.x - last.xs[0] <= tolerance * 5) {
      last.xs.push(edge.x)
      last.lines.add(edge.line)
    } else {
      piles.push({ xs: [edge.x], lines: new Set([edge.line]) })
    }
  }

  const starts = piles
    .filter((pile) => pile.lines.size >= support)
    .map((pile) => ({ x: median(pile.xs), left: pile.xs[0] }))
    .sort((a, b) => a.x - b.x)
  if (starts.length < 2) return null

  // The whitespace is measured in front of the column's leftmost line, not
  // its middle, or a column that drifts would be read as its own gutter.
  const columns = [starts[0].x]
  for (const start of starts.slice(1)) {
    if (crossings(rows, start.left - minGutter, start.left - 2) <= allowedCrossings) columns.push(start.x)
  }
  return columns.length >= 2 ? columns : null
}

/** Where the definition starts: at the script change, or at the last column. */
function definitionColumn(cells: string[][], columns: number[]) {
  const scripts = columns.map((_, index) => dominantScript(cells.map((row) => row[index])))
  const last = scripts[scripts.length - 1]
  if (last) {
    let first = scripts.length - 1
    while (first > 0 && scripts[first - 1] === last) first--
    if (first > 0) return first
  }
  return columns.length - 1
}

function splitByScript(text: string): ParsedPair | null {
  const tokens = text.split(/\s+/).filter(Boolean)
  const scriptOf = (token: string): Script =>
    CYRILLIC.test(token) ? "cyrillic" : LATIN.test(token) ? "latin" : null
  const first = tokens.findIndex((token) => scriptOf(token))
  if (first < 0) return null
  const head = scriptOf(tokens[first])
  const at = tokens.findIndex((token, index) => index > first && scriptOf(token) && scriptOf(token) !== head)
  if (at < 0) return null
  return { term: tokens.slice(0, at).join(" "), definition: tokens.slice(at).join(" ") }
}

/**
 * One line, when the page has no column structure to go by.
 *
 * The switch from one writing system to the other is tried first: on a line
 * of three German forms and one Russian translation it is the only mark that
 * says where the answer begins, while a dash or a run of spaces says only
 * that some cell ended.
 */
function pairFromText(text: string): ParsedPair {
  const split = splitByScript(text)
  if (split) return { term: split.term.replace(/[\s\-–—:|*•]+$/, "").trim(), definition: split.definition }
  const parts = text.split(/\s[-–—:]\s|\t|\s{3,}/)
  if (parts.length > 1 && parts[0].trim()) {
    return { term: parts[0].trim(), definition: parts.slice(1).join(" ").trim() }
  }
  return { term: text.trim(), definition: "" }
}

/** Turns recognized lines into term/definition pairs. */
export function pairsFromLines(lines: OcrLine[]): ParsedPair[] {
  const columns = detectColumns(lines)
  if (!columns) return lines.map((line) => pairFromText(line.text)).filter((pair) => pair.term || pair.definition)

  const tolerance = Math.max(median(lines.flatMap((line) => line.words).map((word) => word.y1 - word.y0)) * 0.5, 6)
  const rows = lines
    .filter((line) => line.words.length)
    .map((line) => {
      const cells = columns.map(() => [] as string[])
      for (const word of line.words) {
        let index = 0
        while (index + 1 < columns.length && columns[index + 1] <= word.x0 + tolerance) index++
        cells[index].push(word.text)
      }
      return cells.map((cell) => cell.join(" ").trim())
    })

  const start = definitionColumn(rows, columns)
  // A column of nothing but 1. 2. 3. numbers the rows; it is not part of the
  // card. Only ever dropped when a column of terms remains.
  const numbering =
    start >= 2 &&
    rows.filter((cells) => cells[0]).length >= rows.length * 0.8 &&
    rows.every((cells) => !cells[0] || /^\d{1,3}[.)]?$/.test(cells[0]))

  const pairs: ParsedPair[] = []
  for (const cells of rows) {
    const term = cells.slice(numbering ? 1 : 0, start).filter(Boolean).join(" ")
    const definition = cells.slice(start).filter(Boolean).join(" ")
    if (cells[0]) {
      pairs.push({ term, definition })
    } else if (term) {
      // Across the columns but not in the first one: a heading or the table's
      // own title, never a card.
      continue
    } else if (definition && pairs.length) {
      // A translation too long for its cell, wrapped onto the next line.
      const previous = pairs[pairs.length - 1]
      previous.definition = `${previous.definition} ${definition}`.trim()
    }
  }
  return pairs
}

/** Small shots are scaled up to about this, where the engine reads best. */
const TARGET_WIDTH = 1700
const MAX_UPSCALE = 2.5
const MAX_PIXELS = 4_000_000

/** Mean of each pixel's neighbourhood, as a separable box blur. */
function boxBlur(source: Float32Array, width: number, height: number, radius: number) {
  const horizontal = new Float32Array(source.length)
  for (let y = 0; y < height; y++) {
    const row = y * width
    let sum = 0
    for (let x = 0; x <= radius && x < width; x++) sum += source[row + x]
    for (let x = 0; x < width; x++) {
      const from = Math.max(0, x - radius)
      const to = Math.min(width - 1, x + radius)
      horizontal[row + x] = sum / (to - from + 1)
      if (x + radius + 1 < width) sum += source[row + x + radius + 1]
      if (x - radius >= 0) sum -= source[row + x - radius]
    }
  }
  const out = new Float32Array(source.length)
  for (let x = 0; x < width; x++) {
    let sum = 0
    for (let y = 0; y <= radius && y < height; y++) sum += horizontal[y * width + x]
    for (let y = 0; y < height; y++) {
      const from = Math.max(0, y - radius)
      const to = Math.min(height - 1, y + radius)
      out[y * width + x] = sum / (to - from + 1)
      if (y + radius + 1 < height) sum += horizontal[(y + radius + 1) * width + x]
      if (y - radius >= 0) sum -= horizontal[(y - radius) * width + x]
    }
  }
  return out
}

function percentile(histogram: Uint32Array, total: number, fraction: number) {
  let seen = 0
  for (let value = 0; value < histogram.length; value++) {
    seen += histogram[value]
    if (seen >= total * fraction) return value
  }
  return histogram.length - 1
}

/**
 * How often two neighbouring pixels are exactly the same shade. A screenshot
 * is full of flat areas and scores high; a photograph, with its sensor noise
 * and compression, almost never repeats a value.
 */
function flatness(data: Uint8ClampedArray, width: number, height: number) {
  let same = 0
  let seen = 0
  for (let y = 0; y < height; y += 3) {
    for (let x = 0; x < width - 1; x += 3) {
      const i = (y * width + x) * 4
      if (data[i] === data[i + 4] && data[i + 1] === data[i + 5] && data[i + 2] === data[i + 6]) same++
      seen++
    }
  }
  return seen ? same / seen : 1
}

/** Below this, the shot was taken with a camera rather than saved by a phone. */
const PHOTO_FLATNESS = 0.6

/**
 * Photos of a screen are what recognition handles worst: the lighting slides
 * across the page, and half the lists are white on black. Such a shot is
 * turned dark-on-light and divided by its own blurred self, so that a bright
 * corner weighs no more than a dim one, and its contrast is stretched back
 * out afterwards.
 *
 * A screenshot gets none of that beyond the inversion: its letters are
 * already as clean as they will ever be, and smoothing them only costs
 * accuracy.
 *
 * Exported so the browser suite can check what recognition is actually fed.
 */
export function enhance(image: ImageData) {
  const { width, height, data } = image
  const photographic = flatness(data, width, height) < PHOTO_FLATNESS

  const gray = new Float32Array(width * height)
  const histogram = new Uint32Array(256)
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const value = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    gray[p] = value
    histogram[Math.round(value)]++
  }
  const inverted = percentile(histogram, gray.length, 0.5) < 110
  if (!photographic && !inverted) return image
  if (inverted) {
    for (let p = 0; p < gray.length; p++) gray[p] = 255 - gray[p]
  }

  if (photographic) {
    // Wider than a stroke, so the blur sees the page and not the writing.
    const background = boxBlur(gray, width, height, Math.max(8, Math.round(height / 25)))
    const levels = new Uint32Array(256)
    for (let p = 0; p < gray.length; p++) {
      gray[p] = Math.min(255, (gray[p] / Math.max(background[p], 1)) * 255)
      levels[Math.round(gray[p])]++
    }
    const low = percentile(levels, gray.length, 0.02)
    const high = percentile(levels, gray.length, 0.98)
    if (high - low > 20) {
      for (let p = 0; p < gray.length; p++) gray[p] = ((gray[p] - low) / (high - low)) * 255
    }
  }

  for (let p = 0, i = 0; p < gray.length; p++, i += 4) {
    const value = gray[p] < 0 ? 0 : gray[p] > 255 ? 255 : gray[p]
    data[i] = value
    data[i + 1] = value
    data[i + 2] = value
    data[i + 3] = 255
  }
  return image
}

/** Scales a shot to a size recognition copes with and cleans it up. */
async function prepare(blob: Blob): Promise<Blob | HTMLCanvasElement> {
  if (typeof document === "undefined" || typeof createImageBitmap !== "function") return blob
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(blob)
  } catch {
    return blob
  }
  try {
    const scale = Math.min(
      Math.max(1, Math.min(TARGET_WIDTH / bitmap.width, MAX_UPSCALE)),
      Math.sqrt(MAX_PIXELS / (bitmap.width * bitmap.height)),
    )
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext("2d", { willReadFrequently: true })
    if (!context) return blob
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = "high"
    context.drawImage(bitmap, 0, 0, width, height)
    context.putImageData(enhance(context.getImageData(0, 0, width, height)), 0, 0)
    return canvas
  } catch {
    return blob
  } finally {
    bitmap.close?.()
  }
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
    // Screenshots carry no resolution of their own; saying what it is keeps
    // the engine from guessing one and rescaling the letters.
    await worker.setParameters({ user_defined_dpi: "300", preserve_interword_spaces: "1" })
    const all: ParsedPair[] = []
    for (let index = 0; index < images.length; index++) {
      onProgress?.({ stage: `Подготовка ${index + 1} из ${images.length}`, percent: 0 })
      const prepared = await prepare(images[index])
      onProgress?.({ stage: `Распознавание ${index + 1} из ${images.length}`, percent: 0 })
      const result = await worker.recognize(prepared as Blob, {}, { blocks: true, text: true })
      const lines = collectLines(result.data.blocks ?? result.data)
      const pairs = lines.length
        ? pairsFromLines(lines)
        : (result.data.text ?? "")
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .map(pairFromText)
      // Each shot is a page of its own: its columns, its heading, and its own
      // two languages to tell apart.
      const kept = pairs.filter((pair) => (pair.term + pair.definition).replace(/\s/g, "").length > 1)
      all.push(...dropHeadings(harmonizeScripts(kept)))
    }
    return all
  } finally {
    await worker.terminate()
  }
}
