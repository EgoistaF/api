import path from "node:path"
import { blobDriver } from "./blob.ts"
import { filesystemDriver } from "./filesystem.ts"
import { redisConfigured, redisDriver } from "./redis.ts"
import type { StorageDriver } from "./types.ts"

export { StorageError, type UserRecord } from "./types.ts"

function dataDir() {
  return process.env.DATA_DIR || path.join(process.cwd(), ".data")
}

/**
 * Picks where profiles are kept.
 *
 * A self-hosted server has a disk and no quota, so the filesystem is the
 * default. A hosted one is recognised by the variables its store sets:
 * Redis first, because Blob's free plan counts every save against a monthly
 * allowance of two thousand and Redis does not. STORAGE_DRIVER overrides all
 * of it.
 */
function chooseDriver(): StorageDriver {
  const requested = process.env.STORAGE_DRIVER
  if (requested === "filesystem") return filesystemDriver(dataDir())
  if (requested === "blob") return blobDriver
  if (requested === "redis") return redisDriver
  if (redisConfigured()) return redisDriver
  return process.env.BLOB_READ_WRITE_TOKEN ? blobDriver : filesystemDriver(dataDir())
}

export const storage = chooseDriver()

export const readJson: StorageDriver["readJson"] = (pathname) => storage.readJson(pathname)
export const writeJson: StorageDriver["writeJson"] = (pathname, data) => storage.writeJson(pathname, data)
export const storageReadable = () => storage.readable()
export const storageName = () => storage.name
export const storageLocation = () => storage.location

/** A quota or a full disk shows up only through a write that failed. */
export const lastWriteFailure = () => storage.lastWriteFailure?.() ?? null
