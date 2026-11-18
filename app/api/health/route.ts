import { NextResponse } from "next/server"
import { storageReadable, storageWritable } from "@/lib/server/blob-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Whether the profile service is configured and reachable.
 * Reports booleans only — never a secret, a value or user data.
 */
export async function GET() {
  const authSecret = Boolean(process.env.AUTH_SECRET)
  const blobToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN)
  const configured = authSecret && blobToken
  const [read, write] = configured ? await Promise.all([storageReadable(), storageWritable()]) : [false, false]
  return NextResponse.json({
    ok: configured && read && write,
    authSecret,
    blobToken,
    storageRead: read,
    storageWrite: write,
  })
}
