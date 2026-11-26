import { gunzipSync, gzipSync } from "node:zlib"
import { list, put } from "@vercel/blob"
import { assertSafePath, isGzip, StorageError, type StorageDriver } from "./types.ts"

/** Vercel Blob rejects a cache age below its minimum. */
const MIN_CACHE_SECONDS = 60

/**
 * Vercel Blob bills `put` and `list` as "advanced operations" and the Hobby
 * plan allows only 2 000 a month. Downloading a blob by its URL is not one,
 * so reads go straight to the public URL and `list` is called at most once
 * per cold start, only to learn the store's host. Set BLOB_BASE_URL to skip
 * even that.
 */
let cachedBase: string | null = process.env.BLOB_BASE_URL?.replace(/\/$/, "") ?? null

function rememberBase(url: string) {
  try {
    cachedBase = new URL(url).origin
  } catch {
    /* keep whatever we had */
  }
}

async function baseUrl(): Promise<string | null> {
  if (cachedBase) return cachedBase
  try {
    const found = await list({ limit: 1 })
    const sample = found.blobs[0]
    if (sample) rememberBase(sample.url)
  } catch (cause) {
    console.error("[storage] could not resolve blob host", cause)
  }
  return cachedBase
}

/** Last write failure, so the health endpoint can report it without writing. */
let lastWriteError: { at: number; message: string } | null = null

async function writeJson(pathname: string, data: unknown) {
  assertSafePath(pathname)
  try {
    // Stored gzipped: a full library is ~500 KB of JSON but under 60 KB
    // compressed, which keeps data transfer small as well.
    const result = await put(pathname, gzipSync(Buffer.from(JSON.stringify(data))), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/octet-stream",
      cacheControlMaxAge: MIN_CACHE_SECONDS,
    })
    rememberBase(result.url)
    lastWriteError = null
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    console.error("[storage] write failed", pathname, message)
    lastWriteError = { at: Date.now(), message }
    throw new StorageError("write", cause)
  }
}

async function download<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" })
    if (!response.ok) return null
    const bytes = Buffer.from(await response.arrayBuffer())
    if (!bytes.length) return null
    // Files written before compression was added are plain JSON.
    return JSON.parse(isGzip(bytes) ? gunzipSync(bytes).toString() : bytes.toString()) as T
  } catch {
    return null
  }
}

/** Reads one stored file. Costs no advanced operation once the host is known. */
async function readJson<T>(pathname: string): Promise<T | null> {
  const base = await baseUrl()
  if (!base) return null
  return download<T>(`${base}/${pathname}`)
}

async function readable() {
  try {
    return Boolean(await baseUrl())
  } catch {
    return false
  }
}

export const blobDriver: StorageDriver = {
  name: "blob",
  location: "Vercel Blob",
  readJson,
  writeJson,
  readable,
  lastWriteFailure: () => lastWriteError,
}
