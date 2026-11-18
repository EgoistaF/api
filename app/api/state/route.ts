import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE, blobPath, readSessionToken } from "@/lib/server/auth"
import { StorageError, readJson, writeJson } from "@/lib/server/blob-store"
import { mergeStates } from "@/lib/merge"
import type { AppState } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_BYTES = 4 * 1024 * 1024
const STORAGE_MESSAGE =
  "Сервис профилей сейчас недоступен. Данные остались на этом устройстве — попробуйте позже."

async function currentUserId() {
  const jar = await cookies()
  return readSessionToken(jar.get(SESSION_COOKIE)?.value)?.id ?? null
}

function looksLikeState(value: unknown): value is AppState {
  return Boolean(value) && typeof value === "object" && Array.isArray((value as { sets?: unknown }).sets)
}

export async function GET() {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: "Не выполнен вход" }, { status: 401 })

  const stored = await readJson<AppState>(blobPath("state", userId))
  return NextResponse.json({ state: looksLikeState(stored) ? stored : null })
}

export async function PUT(request: Request) {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: "Не выполнен вход" }, { status: 401 })

  const raw = await request.text()
  if (raw.length > MAX_BYTES) {
    return NextResponse.json({ error: "Библиотека слишком велика для синхронизации" }, { status: 413 })
  }

  let incoming: unknown
  try {
    incoming = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 })
  }
  if (!looksLikeState(incoming)) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 })
  }

  const path = blobPath("state", userId)
  try {
    // Merge with what is already stored instead of replacing it. Downloading
    // costs no advanced operation, and a union merge means a device that was
    // briefly out of date cannot wipe another device's work.
    const stored = await readJson<AppState>(path)
    const next = looksLikeState(stored) ? mergeStates(incoming, stored) : incoming
    await writeJson(path, next)
  } catch (cause) {
    if (cause instanceof StorageError) return NextResponse.json({ error: STORAGE_MESSAGE }, { status: 503 })
    throw cause
  }
  return NextResponse.json({ ok: true, savedAt: Date.now() })
}
