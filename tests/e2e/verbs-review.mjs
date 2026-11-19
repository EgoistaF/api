import { ARTIFACTS, BASE, chromium, devices, finish, note, seedCourse, step } from "../helpers.mjs"
import { conjugateOne } from "../../lib/verbs/conjugate.ts"
import { VERBS } from "../../lib/verbs/data.ts"
import { PERSON_LABELS, TENSE_LABELS } from "../../lib/verbs/types.ts"


const TENSE_BY_LABEL = Object.fromEntries(Object.entries(TENSE_LABELS).map(([k, v]) => [v.toLowerCase(), k]))
const PERSON_BY_LABEL = Object.fromEntries(Object.entries(PERSON_LABELS).map(([k, v]) => [v, k]))
const byInfinitive = new Map(VERBS.map((v) => [v.infinitive, v]))

const b = await chromium.launch()
const ctx = await b.newContext({ ...devices["iPhone 13"], deviceScaleFactor: 2 })
const page = await ctx.newPage()
const errs = []
page.on("pageerror", (e) => errs.push(e.message.slice(0, 180)))

async function readVerbQuestion() {
  const main = page.locator("main")
  const infinitive = (await main.locator("p.text-2xl").first().innerText()).trim()
  const personLabel = (await main.locator("span.text-primary").first().innerText()).trim()
  const tenseLabel = (await main.locator("p.text-xs").first().innerText()).split("·")[0].trim()
  const verb = byInfinitive.get(infinitive)
  const tense = TENSE_BY_LABEL[tenseLabel.toLowerCase()]
  const person = PERSON_BY_LABEL[personLabel]
  if (!verb || !tense || !person) throw new Error(`cannot read: "${infinitive}" / "${tenseLabel}" / "${personLabel}"`)
  return { verb, tense, person, expected: conjugateOne(verb, tense, person) }
}

await step("practising verbs puts them on the review schedule", async () => {
  await page.goto(BASE + "/verbs", { waitUntil: "networkidle" })
  await page.getByRole("button", { name: /Начать/ }).click()
  await page.getByPlaceholder("Напишите форму").waitFor({ timeout: 15000 })
  for (let i = 0; i < 4; i++) {
    const q = await readVerbQuestion()
    await page.getByPlaceholder("Напишите форму").fill(q.expected)
    await page.keyboard.press("Enter")
    await page.waitForTimeout(700)
    const next = page.getByRole("button", { name: "Дальше" })
    if (await next.count()) { await next.click(); await page.waitForTimeout(250) }
  }
  const stored = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("quizmaster.state.v1")).verbProgress || {}).length)
  if (stored < 3) throw new Error("verb progress missing: " + stored)
  console.log("     slots practised:", stored)
})

await step("they are not due immediately, and review says so", async () => {
  await page.goto(BASE + "/review", { waitUntil: "networkidle" })
  await page.waitForSelector("text=К повторению сейчас")
  const body = await page.locator("main").innerText()
  const due = Number(body.match(/К повторению сейчас\s+(\d+)/)[1])
  console.log("     due right after practising:", due)
  if (due !== 0) throw new Error("expected nothing due, got " + due)
  if (!/Следующее повторение через/.test(body)) throw new Error("no next-due time")
})

await step("backdating makes them due and the queue says how many are verbs", async () => {
  await page.evaluate(() => {
    const key = "quizmaster.state.v1"
    const s = JSON.parse(localStorage.getItem(key))
    const longAgo = Date.now() - 40 * 86400000
    for (const k of Object.keys(s.verbProgress)) s.verbProgress[k].lastSeen = longAgo
    localStorage.setItem(key, JSON.stringify(s))
  })
  await page.reload({ waitUntil: "networkidle" })
  await page.waitForSelector("text=К повторению сейчас")
  const body = await page.locator("main").innerText()
  const due = Number(body.match(/К повторению сейчас\s+(\d+)/)[1])
  const verbsLine = body.match(/из них форм глаголов: (\d+)/)
  console.log(`     due: ${due}, of which verbs: ${verbsLine ? verbsLine[1] : "—"}`)
  if (!verbsLine) throw new Error("verb count not shown")
  if (Number(verbsLine[1]) < 3) throw new Error("verbs not counted as due")
})

await step("the review session asks a conjugation question", async () => {
  await page.getByRole("button", { name: /Повторить/ }).click()
  await page.getByPlaceholder("Напишите форму").waitFor({ timeout: 15000 })
  const q = await readVerbQuestion()
  await page.getByPlaceholder("Напишите форму").fill(q.expected)
  await page.keyboard.press("Enter")
  await page.waitForTimeout(700)
  const body = await page.locator("main").innerText()
  if (!/Вспомнили: 1/.test(body)) throw new Error("answer not counted: " + body.slice(0, 160))
})
await page.screenshot({ path: ARTIFACTS + "/review-verb.png" })

await step("the tab badge counts verbs", async () => {
  await page.goto(BASE + "/", { waitUntil: "networkidle" })
  await page.waitForTimeout(900)
  const badge = (await page.locator('nav.fixed a[href="/review"] span.rounded-full').innerText()).trim()
  console.log("     badge:", badge)
  if (!Number(badge)) throw new Error("badge missing: " + badge)
})

await step("stats show conjugation mastery", async () => {
  await page.goto(BASE + "/stats", { waitUntil: "networkidle" })
  await page.waitForSelector("text=Спряжение глаголов")
  const body = await page.locator("main").innerText()
  if (!/Отработано пар «глагол \+ время»: \d+/.test(body)) throw new Error("no verb mastery line")
  console.log("     " + body.match(/Отработано пар «глагол \+ время»: \d+/)[0])
})
await page.screenshot({ path: ARTIFACTS + "/stats-verbs.png", fullPage: true })

console.log("\npage errors: " + errs.length)
errs.slice(0, 4).forEach((e) => console.log("  " + e))
await b.close()
