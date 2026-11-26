/** Thrown when storage itself is unavailable, so routes can say so plainly. */
export class StorageError extends Error {
  // Assigned in the body rather than declared as a constructor parameter, so
  // that `node --experimental-strip-types` can load this module: the checks
  // run the storage drivers straight from source.
  readonly operation: "read" | "write"

  constructor(operation: "read" | "write", cause: unknown) {
    super(`storage ${operation} failed: ${cause instanceof Error ? cause.message : String(cause)}`)
    this.name = "StorageError"
    this.operation = operation
    this.cause = cause
  }
}

export type WriteFailure = { at: number; message: string }

/**
 * Everything the profile service needs from a place to keep bytes. Three
 * drivers implement it: the local filesystem for a self-hosted instance,
 * Vercel Blob, and a Redis store over HTTPS.
 */
export type StorageDriver = {
  readonly name: "blob" | "filesystem" | "redis"
  /** Where the data lives, for the health endpoint. Never a secret. */
  readonly location: string
  readJson<T>(pathname: string): Promise<T | null>
  writeJson(pathname: string, data: unknown): Promise<void>
  /** Whether the store can be reached at all, without touching user data. */
  readable(): Promise<boolean>
  /**
   * The last write that failed, if the driver remembers one. A quota or a
   * full disk shows up in no other way: reading keeps working, and only a
   * write proves the store is refusing them.
   */
  lastWriteFailure?(): WriteFailure | null
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
