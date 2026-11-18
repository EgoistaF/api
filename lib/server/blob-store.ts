import { list, put } from "@vercel/blob"

/** Thrown when blob storage itself is unavailable, so routes can say so plainly. */
export class StorageError extends Error {
  constructor(
    readonly operation: "read" | "write",
    cause: unknown,
  ) {
    super(`blob ${operation} failed: ${cause instanceof Error ? cause.message : String(cause)}`)
    this.name = "StorageError"
    this.cause = cause
  }
}

/**
 * Vercel Blob rejects a cache age below its minimum, so writes ask for the
 * shortest cache it accepts. Freshness does not depend on it: reads bust the
 * CDN with a unique query, each device writes only its own file, and sync
 * merges rather than overwrites.
 */
const MIN_CACHE_SECONDS = 60

export async function writeJson(pathname: string, data: unknown) {
  try {
    await put(pathname, JSON.stringify(data), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: MIN_CACHE_SECONDS,
    })
  } catch (cause) {
    console.error("[storage] write failed", pathname, cause)
    throw new StorageError("write", cause)
  }
}

async function listBlobs(prefix: string, limit: number) {
  try {
    return await list({ prefix, limit })
  } catch (cause) {
    console.error("[storage] list failed", prefix, cause)
    throw new StorageError("read", cause)
  }
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" })
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  }
}

export async function readJson<T>(pathname: string): Promise<T | null> {
  const found = await listBlobs(pathname, 1)
  const blob = found.blobs.find((item) => item.pathname === pathname)
  if (!blob) return null
  return fetchJson<T>(blob.url)
}

/** Every device file stored under one account, newest first. */
export async function listJson<T>(prefix: string, limit = 20): Promise<T[]> {
  const found = await listBlobs(prefix, limit)
  const blobs = found.blobs.sort((a, b) => Number(new Date(b.uploadedAt)) - Number(new Date(a.uploadedAt)))
  const results = await Promise.all(blobs.map((blob) => fetchJson<T>(blob.url)))
  return results.filter((item): item is Awaited<T> => item !== null) as T[]
}

/** Reports whether storage is reachable, without touching any user data. */
export async function storageReachable() {
  try {
    await list({ prefix: "healthcheck/", limit: 1 })
    return true
  } catch {
    return false
  }
}

export type UserRecord = {
  id: string
  username: string
  displayName: string
  salt: string
  hash: string
  createdAt: number
}
