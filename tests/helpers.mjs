/**
 * Shared bits for the browser suites.
 *
 * Playwright is not a dependency of this project: installing it would pull a
 * large package into every deployment build for something only the test run
 * needs. It is resolved from wherever it happens to be available instead.
 */
import { mkdirSync } from "node:fs"
import path from "node:path"

export const BASE = (process.env.BASE || "http://localhost:3000").replace(/\/$/, "")

export const ARTIFACTS = path.resolve(import.meta.dirname, ".artifacts")
mkdirSync(ARTIFACTS, { recursive: true })

async function loadPlaywright() {
  const candidates = ["playwright", "/opt/node-tools/node_modules/playwright/index.js"]
  for (const candidate of candidates) {
    try {
      const loaded = await import(candidate)
      return loaded.chromium ? loaded : loaded.default
    } catch {
      /* try the next one */
    }
  }
  throw new Error("Playwright is not available. Install it with: npm i -D playwright && npx playwright install chromium")
}

const playwright = await loadPlaywright()
export const { devices } = playwright

/**
 * Marks the first-run walk-through as already seen, before the app starts.
 *
 * It covers the screen and swallows every tap until it is dismissed — which
 * is the point of it, and which would otherwise stop every suite on its first
 * click. The suite that tests the walk-through itself writes the flag back to
 * false and reloads.
 */
const TOUR_SEEN = () => {
  try {
    const key = "quizmaster.state.v1"
    const raw = localStorage.getItem(key)
    const state = raw
      ? JSON.parse(raw)
      : {
          version: 1,
          sets: [],
          folders: [],
          progress: {},
          verbProgress: {},
          recent: [],
          deleted: {},
          stats: { studyDays: [], cardsStudied: 0, sessions: 0 },
        }
    // Only when nothing has been said either way: a suite that deliberately
    // asks for the walk-through sets the flag to false and must keep it.
    if (state.settings?.tourSeen === undefined) {
      state.settings = { ...(state.settings || {}), tourSeen: true }
      localStorage.setItem(key, JSON.stringify(state))
    }
  } catch {
    /* a browser without storage shows the walk-through; nothing to do */
  }
}

/** Playwright's chromium, with every context it opens starting past the tour. */
export const chromium = {
  ...playwright.chromium,
  async launch(options) {
    const browser = await playwright.chromium.launch(options)
    const open = browser.newContext.bind(browser)
    browser.newContext = async (contextOptions) => {
      const context = await open(contextOptions)
      await context.addInitScript(TOUR_SEEN)
      return context
    }
    return browser
  },
}

let failures = 0

/** Runs one scenario, reporting it without aborting the rest of the suite. */
export async function step(name, body) {
  try {
    await body()
    console.log("OK   " + name)
  } catch (error) {
    failures += 1
    console.log("FAIL " + name + " :: " + String(error?.message ?? error).slice(0, 300))
  }
}

export const note = (text) => console.log("     " + text)

// A failed scenario fails the suite, whether or not it calls finish().
process.on("beforeExit", () => {
  if (failures) process.exitCode = 1
})

/** Reports page errors; the exit code is already handled above. */
export function finish(pageErrors = []) {
  const real = pageErrors.filter((entry) => !/_vercel\/insights/.test(entry))
  if (real.length) {
    console.log(`\npage errors: ${real.length}`)
    real.slice(0, 5).forEach((entry) => console.log("  " + entry))
  }
  if (failures || real.length) process.exitCode = 1
}

/**
 * Makes the app save to the account now instead of waiting out its debounce.
 * Hiding the tab is what a real device does when it is put away, and the app
 * flushes on exactly that signal.
 */
export async function flushSync(page, settleMs = 2500) {
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true })
    document.dispatchEvent(new Event("visibilitychange"))
  })
  await page.waitForTimeout(settleMs)
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true })
  })
}

/** A library to study: the app starts empty on purpose. */
export async function seedCourse(page) {
  await page.goto(BASE + "/catalog", { waitUntil: "networkidle" })
  await page.getByRole("button", { name: /Добавить 39 модулей/ }).click()
  await page.waitForURL(/\/folder\/|\/library/, { timeout: 30000 })
}
