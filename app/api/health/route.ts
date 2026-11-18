import { NextResponse } from "next/server"
import { lastWriteFailure, storageReadable } from "@/lib/server/blob-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Whether the profile service is configured and reachable.
 * Reports booleans only — never a secret, a value or user data — and performs
 * no write of its own, so checking health cannot itself use up the storage
 * plan's operation budget.
 */
export async function GET() {
  const authSecret = Boolean(process.env.AUTH_SECRET)
  const blobToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN)
  const read = authSecret && blobToken ? await storageReadable() : false
  const failure = lastWriteFailure()
  // A write failure in the last 15 minutes means sign-up is currently broken.
  const writeBroken = Boolean(failure && Date.now() - failure.at < 15 * 60_000)
  return NextResponse.json({
    ok: authSecret && blobToken && read && !writeBroken,
    authSecret,
    blobToken,
    storageRead: read,
    writeBlocked: writeBroken,
  })
}
