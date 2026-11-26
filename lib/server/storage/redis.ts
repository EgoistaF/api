import { gunzipSync, gzipSync } from "node:zlib"
import { assertSafePath, isGzip, StorageError, type StorageDriver } from "./types.ts"

/**
 * Keeps profiles in a Redis store reached over HTTPS — Upstash, or the same
 * thing added through Vercel's marketplace, which is why both pairs of
 * variable names are accepted.
 *
 * This is the driver for a hosted instance whose profiles outgrew Vercel
 * Blob: Blob counts every save as an "advanced operation" and allows two
 * thousand of them a month on the free plan, which one person studying daily
 * can use up. A free Redis store counts plain commands and allows hundreds of
 * thousands, so the same library can be saved as often as it changes.
 *
 * Bytes are stored exactly as the other drivers store them — gzipped JSON —
 * so a profile can be carried from one to another unchanged.
 */

/** Keeps our keys apart from anything else in a shared store. */
const PREFIX = "quizmaster:"

/** Upstash refuses a request body over a megabyte on the free plan. */
const MAX_VALUE_BYTES = 900_000

function endpoint() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  return { url: url.replace(/\/$/, ""), token }
}

/** Whether this instance is configured to use a Redis store at all. */
export const redisConfigured = () => Boolean(endpoint())

let lastWriteError: { at: number; message: string } | null = null

/** One Redis command over the REST protocol: ["GET", key] and the like. */
async function command<T>(parts: string[]): Promise<T> {
  const target = endpoint()
  if (!target) throw new Error("Redis REST endpoint is not configured")
  const response = await fetch(target.url, {
    method: "POST",
    headers: { authorization: `Bearer ${target.token}`, "content-type": "application/json" },
    body: JSON.stringify(parts),
    cache: "no-store",
  })
  const payload = (await response.json().catch(() => null)) as { result?: T; error?: string } | null
  if (!response.ok || payload?.error) {
    // The command itself is named, never its arguments: those carry the data.
    throw new Error(payload?.error || `${parts[0]} failed with HTTP ${response.status}`)
  }
  return payload?.result as T
}

async function readJson<T>(pathname: string): Promise<T | null> {
  assertSafePath(pathname)
  let stored: string | null
  try {
    stored = await command<string | null>(["GET", PREFIX + pathname])
  } catch (cause) {
    console.error("[storage] read failed", pathname, cause)
    throw new StorageError("read", cause)
  }
  if (!stored) return null
  try {
    const bytes = Buffer.from(stored, "base64")
    return JSON.parse(isGzip(bytes) ? gunzipSync(bytes).toString() : bytes.toString()) as T
  } catch {
    return null
  }
}

async function writeJson(pathname: string, data: unknown) {
  assertSafePath(pathname)
  try {
    const value = gzipSync(Buffer.from(JSON.stringify(data))).toString("base64")
    if (value.length > MAX_VALUE_BYTES) {
      throw new Error("the library is too large for one Redis value")
    }
    await command(["SET", PREFIX + pathname, value])
    lastWriteError = null
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    console.error("[storage] write failed", pathname, message)
    lastWriteError = { at: Date.now(), message }
    throw new StorageError("write", cause)
  }
}

async function readable() {
  try {
    return (await command<string>(["PING"])) === "PONG"
  } catch (cause) {
    console.error("[storage] redis is not reachable", cause)
    return false
  }
}

export const redisDriver: StorageDriver = {
  name: "redis",
  location: "Redis (HTTPS)",
  readJson,
  writeJson,
  readable,
  lastWriteFailure: () => lastWriteError,
}
