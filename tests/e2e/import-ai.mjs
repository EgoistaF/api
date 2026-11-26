import { ARTIFACTS, BASE, chromium, step } from "../helpers.mjs"
import { makeVerbTablePhoto } from "../fixtures.mjs"

/**
 * The model-backed import, without spending anything: the route is answered by
 * the test, so what is checked is the page — that the button appears only with
 * a key, what it sends, and what it does with the answer.
 *
 * The route itself is checked where it can be: with no key at all.
 */

const ANSWER = {
  cards: [
    { term: "beginnen begann begonnen", definition: "начинать" },
    { term: "bleiben blieb geblieben", definition: "оставаться" },
    { term: "essen aß gegessen", definition: "есть" },
  ],
}

;(async () => {
  const photo = await makeVerbTablePhoto()
  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: 430, height: 900 } })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message.slice(0, 200)))

  await step('without a key the page offers the settings instead of the button', async () => {
    await page.goto(BASE + '/import', { waitUntil: 'networkidle' })
    await page.waitForSelector('text=добавьте ключ Anthropic')
    if (await page.getByRole('button', { name: 'Распознать с ИИ' }).count()) {
      throw new Error('the button is offered with no key configured')
    }
  })

  await step('the route says plainly that no key is configured', async () => {
    const result = await page.evaluate(async (base) => {
      const response = await fetch(base + '/api/ai-import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: 'essen\tесть' }),
      })
      return { status: response.status, body: await response.json() }
    }, BASE)
    console.log('     ' + result.status + ' ' + result.body.error)
    if (result.status !== 400 || !/ключ/i.test(result.body.error || '')) {
      throw new Error('unexpected answer: ' + JSON.stringify(result))
    }
  })

  // From here the browser holds a key, and the route is answered by the test.
  const sent = []
  await ctx.addInitScript(() => {
    window.localStorage.setItem('quizmaster.ai.v1', JSON.stringify({ apiKey: 'sk-ant-test', model: 'claude-opus-5-5' }))
  })
  await page.route('**/api/ai-import', async (route) => {
    const request = route.request()
    if (request.method() !== 'POST') return route.continue()
    sent.push({ headers: request.headers(), body: request.postDataJSON() })
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ANSWER) })
  })

  await step('with a key the picture is sent and the answer becomes rows', async () => {
    await page.goto(BASE + '/import', { waitUntil: 'networkidle' })
    await page.setInputFiles('input[type=file]', photo)
    await page.waitForSelector('img[alt=""]')
    await page.getByRole('button', { name: 'Распознать с ИИ' }).click()
    await page.waitForSelector('text=Проверьте строки', { timeout: 30000 })

    const rows = await page.evaluate(() =>
      [...document.querySelectorAll('section:nth-of-type(2) .space-y-2 > div')]
        .map((row) => [...row.querySelectorAll('input')].map((input) => input.value))
        .filter((values) => values.length === 2),
    )
    rows.forEach(([t, d]) => console.log(`       "${t}"  |  "${d}"`))
    if (rows.length !== ANSWER.cards.length) throw new Error('rows: ' + rows.length)
    if (rows[0][0] !== ANSWER.cards[0].term || rows[0][1] !== ANSWER.cards[0].definition) {
      throw new Error('the first row does not match the answer')
    }

    const [call] = sent
    if (call.headers['x-anthropic-key'] !== 'sk-ant-test') throw new Error('the key was not sent with the request')
    if (call.body.model !== 'claude-opus-5-5') throw new Error('the chosen model was not sent: ' + call.body.model)
    if (!call.body.image?.data || !call.body.image.media_type.startsWith('image/')) {
      throw new Error('no picture in the request')
    }
    // Shrunk before sending, not the original file.
    console.log(`     sent ${Math.round((call.body.image.data.length * 3) / 4 / 1024)} KB as ${call.body.image.media_type}`)
  })
  await page.screenshot({ path: ARTIFACTS + '/import-ai.png', fullPage: true })

  await step('"Поправить ИИ" sends the rows alone, with no picture', async () => {
    const before = sent.length
    await page.getByRole('button', { name: 'Поправить ИИ' }).click()
    await page.waitForSelector('text=Строки поправлены', { timeout: 30000 })
    if (sent.length === before) throw new Error('nothing was sent')
    const call = sent[sent.length - 1]
    if (call.body.image) throw new Error('the picture was sent for a text fix')
    if (!/beginnen/.test(call.body.text || '')) throw new Error('the rows were not sent: ' + call.body.text)
  })

  await step('the module is created from what the model returned', async () => {
    await page.locator('#import-title').fill('ИИ тест')
    await page.getByRole('button', { name: /Создать модуль/ }).click()
    await page.waitForURL(/\/set\//, { timeout: 20000 })
    const count = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('quizmaster.state.v1'))
      return state.sets.find((set) => set.title === 'ИИ тест')?.terms.length ?? 0
    })
    console.log('     stored cards:', count)
    if (count !== ANSWER.cards.length) throw new Error('stored cards: ' + count)
  })

  await step('the key never reaches the saved library', async () => {
    const leak = await page.evaluate(() => localStorage.getItem('quizmaster.state.v1').includes('sk-ant-test'))
    if (leak) throw new Error('the key was written into the synced state')
  })

  console.log('\nerrors: ' + errs.length)
  errs.slice(0, 5).forEach((e) => console.log('  ' + e))
  await b.close()
})()
