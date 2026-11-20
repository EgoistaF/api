import { constants } from "node:fs"
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import { gunzipSync, gzipSync } from "node:zlib"
import { assertSafePath, isGzip, StorageError, type StorageDriver } from "./types.ts"

/**
 * Keeps profiles as files on disk. This is the driver for a self-hosted
 * instance: no quotas, no third-party service, and the whole store is a
 * directory that can be copied or backed up with ordinary tools.
 */
export function filesystemDriver(root: string): StorageDriver {
  const resolve = (pathname: string) => {
    assertSafePath(pathname)
    return path.join(root, pathname)
  }

  return {
    name: "filesystem",
    location: root,

    async readJson<T>(pathname: string): Promise<T | null> {
      let bytes: Buffer
      try {
        bytes = await readFile(resolve(pathname))
      } catch (cause) {
        // A profile that was never written is not an error.
        if ((cause as NodeJS.ErrnoException)?.code === "ENOENT") return null
        console.error("[storage] read failed", pathname, cause)
        throw new StorageError("read", cause)
      }
      try {
        return JSON.parse(isGzip(bytes) ? gunzipSync(bytes).toString() : bytes.toString()) as T
      } catch {
        return null
      }
    },

    async writeJson(pathname: string, data: unknown) {
      const target = resolve(pathname)
      try {
        await mkdir(path.dirname(target), { recursive: true })
        // Written beside the target and moved into place, so a crash midway
        // leaves the previous version intact rather than a half-written file.
        const temporary = `${target}.${process.pid}.tmp`
        await writeFile(temporary, gzipSync(Buffer.from(JSON.stringify(data))))
        await rename(temporary, target)
      } catch (cause) {
        console.error("[storage] write failed", pathname, cause)
        throw new StorageError("write", cause)
      }
    },

    async readable() {
      try {
        await mkdir(root, { recursive: true })
        await access(root, constants.R_OK | constants.W_OK)
        return true
      } catch (cause) {
        console.error("[storage] data directory is not usable", root, cause)
        return false
      }
    },
  }
}
