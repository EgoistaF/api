/**
 * Captures every screen in both themes, for looking at what automated checks
 * cannot judge. Writes to tests/.artifacts/.
 */
import path from "node:path"
import { ARTIFACTS, BASE, chromium, devices, seedCourse } from "./helpers.mjs"

const PAGES = [
  ["home", "/"],
  ["review", "/review"],
  ["library", "/library"],
  ["drills", "/drills"],
  ["verbs", "/verbs"],
  ["articles", "/articles"],
  ["catalog", "/catalog"],
  ["stats", "/stats"],
  ["settings", "/settings"],
  ["account", "/account"],
  ["search", "/search?q=Haus"],
  ["import", "/import"],
  ["create", "/create"],
]

const browser = await chromium.launch()
const context = await browser.newContext({ ...devices["iPhone 13"], deviceScaleFactor: 2 })
const page = await context.newPage()

await seedCourse(page)
const setHref = await page.goto(BASE + "/library", { waitUntil: "networkidle" })
  .then(() => page.locator('a[href^="/set/"]').first().getAttribute("href"))

const targets = [
  ...PAGES,
  ["set", setHref],
  ["set-edit", `${setHref}/edit`],
  ...["flashcards", "learn", "write", "spell", "test", "match"].map((mode) => [`mode-${mode}`, `${setHref}/${mode}`]),
]

for (const theme of ["light", "dark"]) {
  for (const [name, href] of targets) {
    await page.goto(BASE + href, { waitUntil: "networkidle" })
    await page.evaluate((value) => {
      localStorage.setItem("theme", value)
      document.documentElement.classList.toggle("dark", value === "dark")
    }, theme)
    await page.waitForTimeout(600)
    await page.screenshot({ path: path.join(ARTIFACTS, `${theme}-${name}.png`), fullPage: false })
  }
}

console.log(`captured ${targets.length * 2} screenshots in ${ARTIFACTS}`)
await browser.close()
