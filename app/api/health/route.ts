import { NextResponse } from "next/server"
import { storageReachable } from "@/lib/server/blob-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Whether the profile service is configured and reachable.
 * Reports booleans only — never a secret, a value or user data.
 */
export async function GET() {
  const authSecret = Boolean(process.env.AUTH_SECRET)
  const blobToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN)
  const storage = authSecret && blobToken ? await storageReachable() : false
  return NextResponse.json({
    ok: authSecret && blobToken && storage,
    authSecret,
    blobToken,
    storage,
  })
}
