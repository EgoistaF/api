import path from "node:path"
import { blobDriver, blobWriteFailure } from "./blob.ts"
import { filesystemDriver } from "./filesystem.ts"
import type { StorageDriver } from "./types.ts"

export { StorageError, type UserRecord } from "./types.ts"

function dataDir() {
  return process.env.DATA_DIR || path.join(process.cwd(), ".data")
}

/**
 * Picks where profiles are kept.
 *
 * A self-hosted server has a disk and no quota, so the filesystem is the
 * default. Vercel Blob is used when its token is present, or when
 * STORAGE_DRIVER names it explicitly.
 */
function chooseDriver(): StorageDriver {
  const requested = process.env.STORAGE_DRIVER
  if (requested === "filesystem") return filesystemDriver(dataDir())
  if (requested === "blob") return blobDriver
  return process.env.BLOB_READ_WRITE_TOKEN ? blobDriver : filesystemDriver(dataDir())
}

export const storage = chooseDriver()

export const readJson: StorageDriver["readJson"] = (pathname) => storage.readJson(pathname)
export const writeJson: StorageDriver["writeJson"] = (pathname, data) => storage.writeJson(pathname, data)
export const storageReadable = () => storage.readable()
export const storageName = () => storage.name
export const storageLocation = () => storage.location

/** Blob reports a quota block only through a failed write; a disk does not. */
export const lastWriteFailure = () => (storage.name === "blob" ? blobWriteFailure() : null)
