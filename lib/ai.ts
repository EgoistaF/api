/**
 * Reading a word list with a model, as an alternative to the recognition that
 * runs in the browser.
 *
 * The engine in lib/ocr.ts reads letters; it cannot tell a heading from a card
 * or guess what a smudged letter was meant to be. A model can, at the cost of
 * sending the picture to Anthropic — so it is never the default, only a button
 * the user presses.
 *
 * Everything here is shared by the page and by the route that holds the key:
 * the browser never talks to Anthropic directly.
 */

import type { ParsedPair } from "./text"

export type AiModel = { id: string; label: string; note: string }

/** The two models offered. Nothing else is accepted by the route. */
export const AI_MODELS: AiModel[] = [
  {
    id: "claude-haiku-5-5",
    label: "Claude Haiku 5.5 — быстрая и дешёвая",
    note: "Печатный список читает уверенно. Около цента за десяток снимков.",
  },
  {
    id: "claude-opus-5-5",
    label: "Claude Opus 5.5 — самая сильная",
    note: "Разбирает почерк и мятую бумагу. Несколько центов за снимок.",
  },
]

export const DEFAULT_MODEL = AI_MODELS[0].id

export function isKnownModel(value: unknown): value is string {
  return typeof value === "string" && AI_MODELS.some((model) => model.id === value)
}

/** The most cards one picture may produce; beyond this the answer is noise. */
export const MAX_CARDS = 400

/** What the model must return. */
export const CARDS_SCHEMA = {
  type: "object",
  properties: {
    cards: {
      type: "array",
      items: {
        type: "object",
        properties: {
          term: { type: "string" },
          definition: { type: "string" },
        },
        required: ["term", "definition"],
        additionalProperties: false,
      },
    },
  },
  required: ["cards"],
  additionalProperties: false,
} as const

/** Keeps the answer to pairs of strings, whatever shape it arrives in. */
export function normalizeCards(value: unknown): ParsedPair[] {
  const list = Array.isArray(value)
    ? value
    : Array.isArray((value as { cards?: unknown } | null)?.cards)
      ? (value as { cards: unknown[] }).cards
      : []

  const pairs: ParsedPair[] = []
  for (const item of list) {
    if (!item || typeof item !== "object") continue
    const card = item as { term?: unknown; definition?: unknown }
    const term = typeof card.term === "string" ? card.term.trim() : ""
    const definition = typeof card.definition === "string" ? card.definition.trim() : ""
    if (!term && !definition) continue
    pairs.push({ term, definition })
    if (pairs.length >= MAX_CARDS) break
  }
  return pairs
}

/** The rows as the model will read them back, one card per line. */
export function pairsToText(pairs: ParsedPair[]): string {
  return pairs
    .map((pair) => `${pair.term.trim()}\t${pair.definition.trim()}`.trim())
    .filter(Boolean)
    .join("\n")
}

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_TEXT_LENGTH = 24_000

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

/* ------------------------------------------------------------------ *
 * Browser side
 * ------------------------------------------------------------------ */

export type AiSettings = { apiKey: string; model: string }

const SETTINGS_KEY = "quizmaster.ai.v1"

/**
 * Kept out of the synced library on purpose: a key belongs to the person at
 * this browser, not in a profile that travels between devices and servers.
 */
export function loadAiSettings(): AiSettings {
  const fallback: AiSettings = { apiKey: "", model: DEFAULT_MODEL }
  if (typeof window === "undefined") return fallback
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY)
    if (!raw) return fallback
    const stored = JSON.parse(raw) as Partial<AiSettings>
    return {
      apiKey: typeof stored.apiKey === "string" ? stored.apiKey.trim() : "",
      model: isKnownModel(stored.model) ? stored.model : DEFAULT_MODEL,
    }
  } catch {
    return fallback
  }
}

export function saveAiSettings(settings: AiSettings) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    /* a browser with storage switched off still works, just forgets the key */
  }
}

export type AiStatus = { configured: boolean; serverKey: boolean }

/** Whether the server holds a key of its own, so the page can say as much. */
export async function fetchAiStatus(): Promise<AiStatus> {
  try {
    const response = await fetch("/api/ai-import")
    if (!response.ok) return { configured: false, serverKey: false }
    const data = (await response.json()) as { serverKey?: boolean }
    return { configured: Boolean(data.serverKey), serverKey: Boolean(data.serverKey) }
  } catch {
    return { configured: false, serverKey: false }
  }
}

async function ask(body: Record<string, unknown>, apiKey: string): Promise<ParsedPair[]> {
  const response = await fetch("/api/ai-import", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // Sent per request and never stored on the server.
      ...(apiKey ? { "x-anthropic-key": apiKey } : {}),
    },
    body: JSON.stringify(body),
  })
  const data = (await response.json().catch(() => ({}))) as { cards?: unknown; error?: string }
  if (!response.ok) throw new Error(data.error || "Не удалось обратиться к модели")
  return normalizeCards(data.cards)
}

function readAsBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"))
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "")
    reader.readAsDataURL(file)
  })
}

/**
 * Shrinks a photo to something worth sending: a 12-megapixel shot costs tokens
 * and time without telling the model anything a 1600-pixel-wide one does not.
 */
async function toPayload(file: Blob): Promise<{ media_type: string; data: string }> {
  const fits = file.size <= MAX_IMAGE_BYTES && IMAGE_TYPES.includes(file.type)
  if (typeof document === "undefined" || typeof createImageBitmap !== "function") {
    if (!fits) throw new Error("Снимок слишком большой — уменьшите его перед отправкой")
    return { media_type: file.type, data: await readAsBase64(file) }
  }
  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 1600 / bitmap.width)
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext("2d")
    if (!context) throw new Error("canvas unavailable")
    context.imageSmoothingQuality = "high"
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const data = canvas.toDataURL("image/jpeg", 0.85).split(",")[1] ?? ""
    if (!data) throw new Error("empty canvas")
    return { media_type: "image/jpeg", data }
  } catch {
    if (!fits) throw new Error("Снимок слишком большой — уменьшите его перед отправкой")
    return { media_type: file.type, data: await readAsBase64(file) }
  } finally {
    bitmap?.close?.()
  }
}

export type AiProgress = { stage: string; percent: number }

/** Reads the pictures themselves. */
export async function recognizeWithAi(
  images: Blob[],
  settings: AiSettings,
  onProgress?: (progress: AiProgress) => void,
): Promise<ParsedPair[]> {
  const all: ParsedPair[] = []
  for (let index = 0; index < images.length; index++) {
    onProgress?.({
      stage: `Модель читает ${index + 1} из ${images.length}`,
      percent: Math.round((index / images.length) * 100),
    })
    const image = await toPayload(images[index])
    all.push(...(await ask({ model: settings.model, image }, settings.apiKey)))
  }
  onProgress?.({ stage: "Готово", percent: 100 })
  return all
}

/** Cleans up what the browser already read, without sending the picture. */
export async function fixWithAi(pairs: ParsedPair[], settings: AiSettings): Promise<ParsedPair[]> {
  const text = pairsToText(pairs)
  if (!text) return []
  return ask({ model: settings.model, text: text.slice(0, MAX_TEXT_LENGTH) }, settings.apiKey)
}
