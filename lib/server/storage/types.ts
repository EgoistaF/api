/** Thrown when storage itself is unavailable, so routes can say so plainly. */
export class StorageError extends Error {
  constructor(
    readonly operation: "read" | "write",
    cause: unknown,
  ) {
    super(`storage ${operation} failed: ${cause instanceof Error ? cause.message : String(cause)}`)
    this.name = "StorageError"
    this.cause = cause
  }
}

/**
 * Everything the profile service needs from a place to keep bytes.
 * Two drivers implement it: Vercel Blob, and the local filesystem for a
 * self-hosted instance.
 */
export type StorageDriver = {
  readonly name: "blob" | "filesystem"
  /** Where the data lives, for the health endpoint. Never a secret. */
  readonly location: string
  readJson<T>(pathname: string): Promise<T | null>
  writeJson(pathname: string, data: unknown): Promise<void>
  /** Whether the store can be reached at all, without touching user data. */
  readable(): Promise<boolean>
}

export type UserRecord = {
  id: string
  username: string
  displayName: string
  salt: string
  hash: string
  createdAt: number
}

const GZIP_MAGIC = [0x1f, 0x8b]

/** Both drivers store the same bytes, so data can be moved between them. */
export function isGzip(bytes: Buffer) {
  return bytes.length > 1 && bytes[0] === GZIP_MAGIC[0] && bytes[1] === GZIP_MAGIC[1]
}

/** Stored paths are HMAC digests; this keeps a malformed one inside the store. */
export function assertSafePath(pathname: string) {
  if (!pathname || pathname.startsWith("/") || pathname.includes("..") || pathname.includes("\0")) {
    throw new Error(`unsafe storage path: ${pathname}`)
  }
}
