import Anthropic from "@anthropic-ai/sdk"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE, readSessionToken } from "@/lib/server/auth"
import {
  CARDS_SCHEMA,
  DEFAULT_MODEL,
  IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_TEXT_LENGTH,
  isKnownModel,
  normalizeCards,
} from "@/lib/ai"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
/** A photograph of a long list can take the model a while. */
export const maxDuration = 120

/**
 * Reads a word list with Claude and hands back cards.
 *
 * The key never reaches the browser: either the server has one in its
 * environment, or the user keeps their own and sends it with the request,
 * where it is used for that one call and not stored.
 */

const SYSTEM = `Ты разбираешь списки слов для учебных карточек.

Отвечай строго по схеме: массив карточек, в каждой "term" и "definition".
- term — слово или выражение на изучаемом языке. Если в строке несколько форм
  одного слова (Infinitiv, Präteritum, Partizip II и т. п.), собери их в один
  term через пробел, в том же порядке.
- definition — перевод или объяснение из той же строки.

Правила:
- Бери только то, что есть в источнике. Ничего не придумывай и не переводи
  сам: если перевода в строке нет, оставь definition пустой строкой.
- Заголовки, названия колонок, нумерация строк, подписи и номера страниц —
  не карточки, пропускай их.
- Сохраняй исходное написание: регистр, артикли, умляуты, ß, ударения,
  запятые между вариантами перевода.
- Порядок карточек — как в источнике. Пустых карточек не возвращай.`

const IMAGE_TASK = `Это снимок списка слов. Верни карточки.

Распознавание на снимке может быть нечётким — читай по смыслу языка, но не
дописывай слов, которых на снимке нет.`

const TEXT_TASK = `Ниже строки списка слов, распознанные программой: сначала
термин, потом знак табуляции, потом перевод. Распознавание ошибается в буквах
и иногда неверно делит строку.

Почини очевидные ошибки распознавания (латиница вместо кириллицы и наоборот,
перепутанные похожие буквы, слипшиеся формы) и верни карточки. Не переводи
ничего сам и не добавляй новых строк.`

const KEY_MISSING =
  "Ключ Anthropic API не настроен. Добавьте его в Настройках или задайте ANTHROPIC_API_KEY на сервере."
const SIGN_IN =
  "Ключом сервера пользуются только вошедшие в профиль. Войдите или добавьте свой ключ в Настройках."

/**
 * The server's own key is a shared, billable resource, so on a deployment
 * that has accounts only a signed-in visitor may spend it. A key the visitor
 * brought themselves needs no account, and neither does a deployment without
 * `AUTH_SECRET`, where nobody can sign in at all.
 */
async function mayUseServerKey() {
  if (!process.env.AUTH_SECRET) return true
  try {
    const jar = await cookies()
    return Boolean(readSessionToken(jar.get(SESSION_COOKIE)?.value))
  } catch {
    return false
  }
}

type Body = {
  model?: unknown
  text?: unknown
  image?: { media_type?: unknown; data?: unknown }
}

export async function GET() {
  // Only whether a key exists — never the key itself.
  return NextResponse.json({ serverKey: Boolean(process.env.ANTHROPIC_API_KEY?.trim()) })
}

export async function POST(request: Request) {
  const ownKey = request.headers.get("x-anthropic-key")?.trim()
  const apiKey = ownKey || process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) return NextResponse.json({ error: KEY_MISSING }, { status: 400 })
  if (!ownKey && !(await mayUseServerKey())) {
    return NextResponse.json({ error: SIGN_IN }, { status: 401 })
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 })
  }

  const model = isKnownModel(body.model) ? body.model : DEFAULT_MODEL

  let content: Anthropic.ContentBlockParam[]
  if (body.image) {
    const mediaType = String(body.image.media_type ?? "")
    const data = typeof body.image.data === "string" ? body.image.data : ""
    if (!IMAGE_TYPES.includes(mediaType)) {
      return NextResponse.json({ error: "Такой формат картинки не поддерживается" }, { status: 400 })
    }
    // base64 carries three bytes in every four characters.
    if (!data || (data.length * 3) / 4 > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Снимок слишком большой" }, { status: 413 })
    }
    content = [
      { type: "image", source: { type: "base64", media_type: mediaType as "image/jpeg", data } },
      { type: "text", text: IMAGE_TASK },
    ]
  } else if (typeof body.text === "string" && body.text.trim()) {
    content = [{ type: "text", text: `${TEXT_TASK}\n\n${body.text.slice(0, MAX_TEXT_LENGTH)}` }]
  } else {
    return NextResponse.json({ error: "Нечего распознавать" }, { status: 400 })
  }

  const client = new Anthropic({ apiKey })
  const params = {
    model,
    max_tokens: 16000,
    system: SYSTEM,
    messages: [{ role: "user" as const, content }],
    output_config: {
      // Reading a list off a page needs care, not deliberation.
      effort: "low" as const,
      format: { type: "json_schema" as const, schema: CARDS_SCHEMA as Record<string, unknown> },
    },
  }

  try {
    // Opus can decline a request outright; the server-side fallback re-runs it
    // on another model inside the same call. Haiku has no such fallback.
    const message =
      model === "claude-opus-5-5"
        ? await client.beta.messages.parse({
            ...params,
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
          })
        : await client.messages.parse(params)

    if (message.stop_reason === "refusal") {
      return NextResponse.json({ error: "Модель отказалась читать этот снимок" }, { status: 422 })
    }

    const cards = normalizeCards(message.parsed_output ?? textJson(message.content))
    if (!cards.length) {
      return NextResponse.json({ error: "Модель не нашла в снимке списка слов" }, { status: 422 })
    }
    if (message.stop_reason === "max_tokens") {
      return NextResponse.json({ cards, truncated: true })
    }
    return NextResponse.json({ cards })
  } catch (cause) {
    return NextResponse.json({ error: describe(cause) }, { status: status(cause) })
  }
}

/** The answer as JSON when the structured output did not come back parsed. */
function textJson(content: { type: string; text?: string }[]): unknown {
  const text = content
    .map((block) => (block.type === "text" ? (block.text ?? "") : ""))
    .join("")
    .trim()
  if (!text) return null
  try {
    return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1))
  } catch {
    return null
  }
}

function describe(cause: unknown) {
  if (cause instanceof Anthropic.AuthenticationError) return "Ключ Anthropic API не принят"
  if (cause instanceof Anthropic.PermissionDeniedError) return "У этого ключа нет доступа к модели"
  if (cause instanceof Anthropic.RateLimitError) return "Слишком много запросов подряд — попробуйте через минуту"
  if (cause instanceof Anthropic.BadRequestError) return "Модель не приняла запрос. Попробуйте снимок попроще."
  if (cause instanceof Anthropic.APIConnectionError) return "Не удалось связаться с Anthropic"
  if (cause instanceof Anthropic.APIError) return "Сервис модели сейчас недоступен"
  return "Не удалось обратиться к модели"
}

function status(cause: unknown) {
  if (cause instanceof Anthropic.AuthenticationError) return 401
  if (cause instanceof Anthropic.PermissionDeniedError) return 403
  if (cause instanceof Anthropic.RateLimitError) return 429
  if (cause instanceof Anthropic.BadRequestError) return 400
  return 502
}
