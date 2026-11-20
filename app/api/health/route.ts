import { NextResponse } from "next/server"
import { lastWriteFailure, storageLocation, storageName, storageReadable } from "@/lib/server/storage"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Whether the profile service is configured and reachable.
 * Reports booleans and the storage driver's name — never a secret, a value
 * or user data — and performs no write, so checking status cannot itself use
 * up a hosted store's operation budget.
 */
export async function GET() {
  const authSecret = Boolean(process.env.AUTH_SECRET)
  const read = authSecret ? await storageReadable() : false
  const failure = lastWriteFailure()
  // A write failure in the last 15 minutes means sign-up is currently broken.
  const writeBlocked = Boolean(failure && Date.now() - failure.at < 15 * 60_000)
  return NextResponse.json({
    ok: authSecret && read && !writeBlocked,
    authSecret,
    storage: storageName(),
    storageLocation: storageLocation(),
    storageRead: read,
    writeBlocked,
  })
}
