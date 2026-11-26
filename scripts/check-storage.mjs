/**
 * Checks the Redis profile store against a stand-in for Upstash that runs
 * inside this script: what the driver sends, what it stores, and how it
 * behaves when the store refuses — which is the case that matters, because a
 * store out of quota keeps answering reads and only fails on writes.
 */
import http from "node:http"
import { randomBytes } from "node:crypto"
import { gunzipSync } from "node:zlib"

let failNextWrite = null
const values = new Map()
const seen = []

const server = http.createServer((request, response) => {
  let body = ""
  request.on("data", (chunk) => (body += chunk))
  request.on("end", () => {
    const [command, key, value] = JSON.parse(body)
    seen.push({ command, key, auth: request.headers.authorization })
    const send = (status, payload) => {
      response.writeHead(status, { "content-type": "application/json" })
      response.end(JSON.stringify(payload))
    }
    if (failNextWrite && command === "SET") return send(429, { error: failNextWrite })
    if (command === "PING") return send(200, { result: "PONG" })
    if (command === "SET") {
      values.set(key, value)
      return send(200, { result: "OK" })
    }
    if (command === "GET") return send(200, { result: values.get(key) ?? null })
    send(400, { error: "unknown command " + command })
  })
})
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
const origin = `http://127.0.0.1:${server.address().port}`

process.env.UPSTASH_REDIS_REST_URL = origin
process.env.UPSTASH_REDIS_REST_TOKEN = "stand-in-token"
// Set before the import: the driver is chosen when the module is first loaded.
const { redisDriver, redisConfigured } = await import("../lib/server/storage/redis.ts")
const { StorageError } = await import("../lib/server/storage/types.ts")

let failures = 0
async function check(name, body) {
  try {
    await body()
    console.log("OK   " + name)
  } catch (error) {
    failures++
    console.log("FAIL " + name + " :: " + (error?.message ?? error))
  }
}
const equal = (got, want, what) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    throw new Error(`${what}\n       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`)
  }
}
const PROFILE = { sets: [{ id: "s1", title: "Starke Verben", terms: [{ term: "essen", definition: "есть" }] }] }

await check("a profile survives the round trip", async () => {
  await redisDriver.writeJson("s/abc.json", PROFILE)
  equal(await redisDriver.readJson("s/abc.json"), PROFILE, "what came back")
})

await check("it is stored as the gzipped JSON the other drivers store", () => {
  const stored = values.get("quizmaster:s/abc.json")
  const bytes = Buffer.from(stored, "base64")
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) throw new Error("not gzip")
  equal(JSON.parse(gunzipSync(bytes).toString()), PROFILE, "the bytes")
})

await check("the token goes in the header and the key is prefixed", () => {
  const call = seen.find((entry) => entry.command === "SET")
  equal(call.auth, "Bearer stand-in-token", "authorization")
  equal(call.key, "quizmaster:s/abc.json", "key")
})

await check("a profile that was never written reads as nothing", async () => {
  equal(await redisDriver.readJson("s/missing.json"), null, "missing profile")
})

await check("a malformed path never reaches the store", async () => {
  const before = seen.length
  let threw = false
  try {
    await redisDriver.writeJson("../escape.json", PROFILE)
  } catch {
    threw = true
  }
  equal([threw, seen.length], [true, before], "threw, and sent nothing")
})

await check("a refused write is reported and remembered", async () => {
  failNextWrite = "ERR max daily request limit exceeded"
  let caught = null
  try {
    await redisDriver.writeJson("s/abc.json", PROFILE)
  } catch (error) {
    caught = error
  }
  if (!(caught instanceof StorageError)) throw new Error("not a StorageError: " + caught)
  const failure = redisDriver.lastWriteFailure()
  if (!/daily request limit/.test(failure?.message ?? "")) {
    throw new Error("the reason was not kept: " + JSON.stringify(failure))
  }
})

await check("reads keep working while writes are refused", async () => {
  equal(await redisDriver.readJson("s/abc.json"), PROFILE, "the stored profile")
  equal(await redisDriver.readable(), true, "readable")
})

await check("a write that succeeds clears the failure", async () => {
  failNextWrite = null
  await redisDriver.writeJson("s/abc.json", PROFILE)
  equal(redisDriver.lastWriteFailure(), null, "remembered failure")
})

await check("a library too large for one value is refused before it is sent", async () => {
  const before = seen.length
  // Random, so that gzip cannot shrink it back under the limit.
  const huge = { sets: [{ id: "big", title: randomBytes(1_500_000).toString("base64") }] }
  let threw = false
  try {
    await redisDriver.writeJson("s/huge.json", huge)
  } catch {
    threw = true
  }
  equal([threw, seen.length], [true, before], "threw, and sent nothing")
})

await check("an unreachable store is not readable, and says so quietly", async () => {
  const url = process.env.UPSTASH_REDIS_REST_URL
  process.env.UPSTASH_REDIS_REST_URL = "http://127.0.0.1:1"
  const reachable = await redisDriver.readable()
  process.env.UPSTASH_REDIS_REST_URL = url
  equal(reachable, false, "readable")
})

await check("without its variables the driver is simply not configured", () => {
  const url = process.env.UPSTASH_REDIS_REST_URL
  delete process.env.UPSTASH_REDIS_REST_URL
  const configured = redisConfigured()
  process.env.UPSTASH_REDIS_REST_URL = url
  equal([configured, redisConfigured()], [false, true], "configured")
})

await check("a Redis store is preferred over a Blob token", async () => {
  process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_stand_in"
  const { storageName } = await import("../lib/server/storage/index.ts")
  delete process.env.BLOB_READ_WRITE_TOKEN
  equal(storageName(), "redis", "chosen driver")
})

server.close()
console.log(`\n${failures ? failures + " checks failed" : "all profile-store checks passed"}`)
process.exit(failures ? 1 : 0)
