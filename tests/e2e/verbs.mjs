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

const field = () => page.getByPlaceholder("Напишите форму")

/** What the page is asking, read straight from the DOM. */
async function readQuestion() {
  const main = page.locator("main")
  const infinitive = (await main.locator("p.text-2xl").first().innerText()).trim()
  const personLabel = (await main.locator("span.text-primary").first().innerText()).trim()
  const tenseLabel = (await main.locator("p.text-xs").first().innerText()).split("·")[0].trim()
  const verb = byInfinitive.get(infinitive)
  const tense = TENSE_BY_LABEL[tenseLabel.toLowerCase()]
  const person = PERSON_BY_LABEL[personLabel]
  if (!verb || !tense || !person) throw new Error(`cannot read question: "${infinitive}" / "${tenseLabel}" / "${personLabel}"`)
  return { verb, tense, person, expected: conjugateOne(verb, tense, person) }
}

await step("setup offers every tense and counts the slots", async () => {
  await page.goto(BASE + "/verbs", { waitUntil: "networkidle" })
  await page.waitForSelector("text=Спряжение глаголов")
  const before = Number((await page.locator("body").innerText()).match(/Доступно вопросов: (\d+)/)[1])
  for (const label of ["Präteritum", "Futur I", "Konjunktiv II", "Imperativ"]) {
    await page.getByText(label, { exact: true }).click()
  }
  await page.waitForTimeout(300)
  const after = Number((await page.locator("body").innerText()).match(/Доступно вопросов: (\d+)/)[1])
  console.log(`     slots: ${before} with two tenses, ${after} with all six`)
  if (after <= before) throw new Error("enabling tenses did not add slots")
})
await page.screenshot({ path: ARTIFACTS + "/setup.png", fullPage: true })

await step("the page asks what the engine would answer", async () => {
  await page.getByRole("button", { name: /Начать/ }).click()
  await field().waitFor({ timeout: 15000 })
  const q = await readQuestion()
  console.log(`     first question: ${q.verb.infinitive} / ${TENSE_LABELS[q.tense]} / ${q.person} -> "${q.expected}"`)
})

await step("a wrong answer names the right form and shows the whole row", async () => {
  const q = await readQuestion()
  await field().fill("completelywrong")
  await page.keyboard.press("Enter")
  await page.waitForSelector("text=Правильная форма:", { timeout: 8000 })
  const body = await page.locator("main").innerText()
  if (!body.includes(q.expected)) throw new Error(`expected form "${q.expected}" not shown`)
  const rows = await page.locator("main div.grid div.flex.items-baseline").count()
  if (rows < 3) throw new Error("conjugation row missing, got " + rows)
  console.log(`     row shows ${rows} persons`)
})
await page.screenshot({ path: ARTIFACTS + "/miss.png", fullPage: true })

await step("every remaining answer, taken from the engine, is accepted", async () => {
  await page.getByRole("button", { name: "Дальше" }).click()
  await page.waitForTimeout(350)
  let answered = 0
  for (let i = 0; i < 20; i++) {
    if (await page.locator("text=Разбор ошибок").count()) break
    if (!(await field().count())) break
    const q = await readQuestion()
    await field().fill(q.expected)
    await page.keyboard.press("Enter")
    answered++
    await page.waitForTimeout(650)
    const next = page.getByRole("button", { name: "Дальше" })
    if (await next.count()) { await next.click(); await page.waitForTimeout(300) }
  }
  console.log(`     answered correctly: ${answered}`)
  if (answered < 10) throw new Error("round ended too early: " + answered)
})

await step("the score counts exactly the one deliberate mistake", async () => {
  await page.waitForSelector("text=Разбор ошибок", { timeout: 20000 })
  const body = await page.locator("main").innerText()
  const score = body.match(/Верно (\d+) из (\d+)/)
  if (!score) throw new Error("no score line")
  console.log(`     ${score[0]}`)
  if (Number(score[2]) - Number(score[1]) !== 1) throw new Error(`expected exactly one miss, got ${score[2] - score[1]}`)
  const misses = await page.locator("main p.text-chart-2").count()
  if (misses !== 1) throw new Error("mistake review should list one item, got " + misses)
})
await page.screenshot({ path: ARTIFACTS + "/results.png", fullPage: true })

await step("practice is remembered for the next round", async () => {
  const stored = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("quizmaster.state.v1")).verbProgress || {}).length)
  console.log(`     verb slots with progress: ${stored}`)
  if (stored < 5) throw new Error("verb progress not stored: " + stored)
})

await step("reachable from the hub and the home page", async () => {
  await page.goto(BASE + "/drills", { waitUntil: "networkidle" })
  await page.getByRole("link", { name: /Спряжение глаголов/ }).first().click()
  await page.waitForURL(/\/verbs/, { timeout: 10000 })
  await page.goto(BASE + "/", { waitUntil: "networkidle" })
  if (!(await page.getByRole("link", { name: /Спряжение глаголов/ }).count())) throw new Error("missing on home")
})

await step("no horizontal overflow", async () => {
  for (const path of ["/verbs", "/drills"]) {
    await page.goto(BASE + path, { waitUntil: "networkidle" })
    const sw = await page.evaluate(() => document.documentElement.scrollWidth)
    const cw = await page.evaluate(() => document.documentElement.clientWidth)
    if (sw > cw + 2) throw new Error(`${path}: ${sw} > ${cw}`)
  }
})

console.log("\npage errors: " + errs.length)
errs.slice(0, 4).forEach((e) => console.log("  " + e))
await b.close()
