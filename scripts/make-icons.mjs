/**
 * Renders public/icon.svg to the PNG sizes launchers and iOS ask for.
 *
 * Run after changing the mark: `node scripts/make-icons.mjs`.
 * Needs Playwright, like the browser tests: npm i -D playwright
 */
import { readFileSync } from "node:fs"
import path from "node:path"

const ROOT = path.resolve(import.meta.dirname, "..")
const svg = readFileSync(path.join(ROOT, "public", "icon.svg"), "utf8")

const OUTPUTS = [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
]

async function loadPlaywright() {
  for (const candidate of ["playwright", "/opt/node-tools/node_modules/playwright/index.js"]) {
    try {
      const loaded = await import(candidate)
      return loaded.chromium ? loaded : loaded.default
    } catch {
      /* next */
    }
  }
  throw new Error("Playwright is not available: npm i -D playwright && npx playwright install chromium")
}

const { chromium } = await loadPlaywright()
const browser = await chromium.launch()

for (const [name, size] of OUTPUTS) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
  await page.setContent(
    `<html><body style="margin:0;width:${size}px;height:${size}px">
       <div style="width:${size}px;height:${size}px">${svg.replace(/width="512" height="512"/, `width="${size}" height="${size}"`)}</div>
     </body></html>`,
  )
  await page.screenshot({ path: path.join(ROOT, "public", name), omitBackground: false })
  await page.close()
  console.log(`${name} ${size}×${size}`)
}

await browser.close()
