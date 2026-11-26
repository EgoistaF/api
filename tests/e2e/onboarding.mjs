import { ARTIFACTS, BASE, chromium, step } from "../helpers.mjs"

/**
 * The walk-through a first-time visitor sees, and the switch that decides
 * which side of a card comes first.
 */

const SET = {
  id: "s1", title: "Starke Verben", description: "", termLang: "de-DE", defLang: "ru-RU",
  folderId: null, createdAt: 1, updatedAt: 2, author: "you",
  terms: [
    { id: "t1", term: "essen", definition: "есть", starred: false },
    { id: "t2", term: "gehen", definition: "идти", starred: false },
  ],
}

/** A library with one module, and the tour either pending or already seen. */
async function seed(page, { tourSeen }) {
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" })
  await page.evaluate(([set, tourSeen]) => {
    const state = JSON.parse(localStorage.getItem("quizmaster.state.v1") || "{}")
    state.sets = [set]
    state.settings = { ...(state.settings || {}), tourSeen, frontIsTerm: true }
    localStorage.setItem("quizmaster.state.v1", JSON.stringify(state))
  }, [SET, tourSeen])
  await page.goto(BASE + "/", { waitUntil: "networkidle" })
}

const tour = (page) => page.locator('[role=dialog][aria-label="Знакомство с приложением"]')
const settings = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("quizmaster.state.v1")).settings)

;(async () => {
  const b = await chromium.launch()
  const errs = []

  // ---- phone: a first visit, skipped straight away -------------------------
  const ctx = await b.newContext({ viewport: { width: 430, height: 900 } })
  const page = await ctx.newPage()
  page.on("pageerror", (e) => errs.push(e.message.slice(0, 200)))

  await step("the tour comes up by itself on a first visit", async () => {
    await seed(page, { tourSeen: false })
    await tour(page).waitFor({ timeout: 10000 })
  })
  await page.screenshot({ path: ARTIFACTS + "/tour-first-step.png" })

  await step('"Пропустить" closes it for good', async () => {
    await page.getByRole("button", { name: "Пропустить" }).click()
    await tour(page).waitFor({ state: "detached", timeout: 5000 })
    if (!(await settings(page)).tourSeen) throw new Error("the answer was not remembered")
    await page.reload({ waitUntil: "networkidle" })
    await page.waitForTimeout(800)
    if (await tour(page).count()) throw new Error("it came back after a reload")
  })

  // ---- every step, and what each one points at -----------------------------
  await step("each step lights up the element it talks about", async () => {
    await seed(page, { tourSeen: false })
    await tour(page).waitFor({ timeout: 10000 })
    const seen = []
    for (let guard = 0; guard < 12; guard++) {
      const counter = await page.locator("[role=dialog] span.tabular-nums").first().innerText()
      seen.push(counter.trim())
      const spotlight = page.locator("[data-tour-spotlight]")
      if (await spotlight.count()) {
        const name = await spotlight.getAttribute("data-tour-spotlight")
        // Measured in the page: both are fixed to the viewport, and Playwright
        // would report them in document coordinates instead.
        const off = await page.evaluate((anchor) => {
          const ring = document.querySelector("[data-tour-spotlight]").getBoundingClientRect()
          // The visible copy: the sidebar one is zero-sized on a phone.
          const node = Array.from(document.querySelectorAll(`[data-tour="${anchor}"]`))
            .find((candidate) => candidate.getBoundingClientRect().width > 0)
          if (!node) return null
          const box = node.getBoundingClientRect()
          return Math.abs(ring.x + 6 - box.x) + Math.abs(ring.y + 6 - box.y)
        }, name)
        if (off === null) throw new Error(`step points at "${name}", which is not on the page`)
        // The page may still be gliding towards the element.
        if (off > 2) {
          await page.waitForFunction(
            (anchor) => {
              const ring = document.querySelector("[data-tour-spotlight]")?.getBoundingClientRect()
              const node = Array.from(document.querySelectorAll(`[data-tour="${anchor}"]`))
                .find((candidate) => candidate.getBoundingClientRect().width > 0)
              if (!ring || !node) return false
              const box = node.getBoundingClientRect()
              return Math.abs(ring.x + 6 - box.x) + Math.abs(ring.y + 6 - box.y) <= 2
            },
            name,
            { timeout: 5000 },
          ).catch(() => {
            throw new Error(`the ring never settles on "${name}" (${Math.round(off)}px away)`)
          })
        }
      }
      const next = page.getByRole("button", { name: /^(Далее|Понятно)$/ })
      const label = await next.innerText()
      await next.click()
      if (label === "Понятно") break
      await page.waitForTimeout(450)
    }
    console.log("     steps: " + seen.join(", "))
    if (seen.length < 5) throw new Error("too few steps: " + seen.length)
    await tour(page).waitFor({ state: "detached", timeout: 5000 })
    if (!(await settings(page)).tourSeen) throw new Error("finishing did not stick")
  })

  await step("an empty library skips the step about modules", async () => {
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" })
    await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem("quizmaster.state.v1") || "{}")
      state.sets = []
      state.recent = []
      state.settings = { ...(state.settings || {}), tourSeen: false }
      localStorage.setItem("quizmaster.state.v1", JSON.stringify(state))
    })
    await page.goto(BASE + "/", { waitUntil: "networkidle" })
    await tour(page).waitFor({ timeout: 10000 })
    const total = (await page.locator("[role=dialog] span.tabular-nums").first().innerText()).split("/")[1].trim()
    console.log(`     steps without a single module: ${total}`)
    if (total !== "6") throw new Error("expected the module step to be left out, got " + total + " steps")
    await page.getByRole("button", { name: "Пропустить" }).click()
    await tour(page).waitFor({ state: "detached", timeout: 5000 })
  })

  await step("the settings bring it back", async () => {
    await page.goto(BASE + "/settings", { waitUntil: "networkidle" })
    await page.getByRole("button", { name: "Показать заново" }).click()
    await page.waitForURL((url) => new URL(url).pathname === "/", { timeout: 10000 })
    await tour(page).waitFor({ timeout: 10000 })
    await page.getByRole("button", { name: "Пропустить" }).click()
  })

  // ---- which side comes first ---------------------------------------------
  await step("one switch turns every mode around", async () => {
    await seed(page, { tourSeen: true })
    await page.goto(BASE + "/set/s1", { waitUntil: "networkidle" })
    const button = page.locator('[data-tour="direction"]')
    if ((await button.innerText()).trim() !== "DE → RU") throw new Error("button reads " + (await button.innerText()))
    if (!(await page.getByText("essen", { exact: true }).first().isVisible())) throw new Error("the card does not start in German")

    await button.click()
    if ((await button.innerText()).trim() !== "RU → DE") throw new Error("the button did not turn around")
    if (!(await page.getByText("есть", { exact: true }).first().isVisible())) throw new Error("the card did not turn around")

    // The question itself, not the whole screen: in "Заучивание" the answers
    // on offer are German by design once the question is Russian.
    for (const [mode, name] of [["write", "Письмо"], ["learn", "Заучивание"]]) {
      await page.goto(`${BASE}/set/s1/${mode}`, { waitUntil: "networkidle" })
      const asked = (await page.locator("[data-prompt]").first().innerText()).trim()
      console.log(`     ${name} спрашивает: «${asked}»`)
      if (!/есть|идти/.test(asked)) throw new Error(`${name} still asks in German: ${asked}`)
    }

    await page.goto(BASE + "/set/s1", { waitUntil: "networkidle" })
    if (!(await settings(page)).frontIsTerm === false) throw new Error("the choice was not remembered")
    await page.locator('[data-tour="direction"]').click()
    if ((await page.locator('[data-tour="direction"]').innerText()).trim() !== "DE → RU") {
      throw new Error("it does not turn back")
    }
  })

  await step("the preview controls fit a narrow phone", async () => {
    const narrow = await b.newContext({ viewport: { width: 360, height: 780 } })
    const small = await narrow.newPage()
    await seed(small, { tourSeen: true })
    await small.goto(BASE + "/set/s1", { waitUntil: "networkidle" })
    const over = await small.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    if (over > 0) throw new Error("the page scrolls sideways by " + over + "px")
    await narrow.close()
  })

  console.log("\nerrors: " + errs.length)
  errs.slice(0, 5).forEach((e) => console.log("  " + e))
  await b.close()
})()
