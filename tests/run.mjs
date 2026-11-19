/**
 * Runs every browser suite against BASE (http://localhost:3000 by default)
 * and reports which ones failed.
 */
import { readdirSync } from "node:fs"
import { spawn } from "node:child_process"
import path from "node:path"

const DIR = path.join(import.meta.dirname, "e2e")
const only = process.argv.slice(2)
const suites = readdirSync(DIR)
  .filter((file) => file.endsWith(".mjs"))
  .filter((file) => !only.length || only.some((name) => file.includes(name)))
  .sort()

const results = []
for (const suite of suites) {
  console.log(`\n── ${suite} ${"─".repeat(Math.max(0, 60 - suite.length))}`)
  const code = await new Promise((resolve) => {
    const child = spawn(process.execPath, ["--experimental-strip-types", "--no-warnings", path.join(DIR, suite)], {
      stdio: "inherit",
      env: process.env,
    })
    child.on("close", resolve)
  })
  results.push({ suite, ok: code === 0 })
}

const failed = results.filter((item) => !item.ok)
console.log(`\n${results.length - failed.length}/${results.length} suites passed`)
failed.forEach((item) => console.log("  failed: " + item.suite))
process.exit(failed.length ? 1 : 0)
