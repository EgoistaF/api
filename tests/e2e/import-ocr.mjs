import { ARTIFACTS, BASE, chromium, devices, finish, note, seedCourse, step } from "../helpers.mjs"
import { makeWordListImage, WORD_LIST } from "../fixtures.mjs"
const EXPECTED = [
  ['die Wohnung', 'квартира'], ['der Schlüssel', 'ключ'], ['das Fenster', 'окно'],
  ['die Treppe', 'лестница'], ['der Kühlschrank', 'холодильник'], ['die Waschmaschine', 'стиральная машина'],
  ['das Erdgeschoss', 'первый этаж'], ['die Miete', 'арендная плата'], ['der Vermieter', 'арендодатель'],
  ['umziehen', 'переезжать'],
]

;(async () => {
  const wordList = await makeWordListImage()

  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: 430, height: 900 } })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message.slice(0, 200)))
  page.on('response', (r) => { if (r.status() >= 400) errs.push('HTTP ' + r.status() + ' ' + r.url().slice(0, 90)) })

  await step('import page loads', async () => {
    await page.goto(BASE + '/import', { waitUntil: 'networkidle' })
    await page.waitForSelector('text=Импорт со скриншота')
  })

  await step('engine assets are served from this origin', async () => {
    for (const path of ['/tesseract/worker.min.js', '/tessdata/deu.traineddata.gz', '/tessdata/rus.traineddata.gz', '/tesseract/tesseract-core-simd-lstm.wasm.js']) {
      const ok = await page.evaluate((url) => fetch(url).then((r) => r.ok).catch(() => false), BASE + path)
      if (!ok) throw new Error(path + ' could not be fetched')
    }
  })

  await step('recognise the word list', async () => {
    await page.setInputFiles('input[type=file]', wordList)
    await page.waitForSelector('img[alt=""]', { timeout: 10000 })
    await page.getByRole('button', { name: /Распознать текст/ }).click()
    await page.waitForSelector('text=Проверьте строки', { timeout: 240000 })
  })
  await page.screenshot({ path: ARTIFACTS + '/import-result.png', fullPage: true })

  await step('rows match the source list', async () => {
    const rows = await page.evaluate(() => {
      const out = []
      for (const row of document.querySelectorAll('section:nth-of-type(2) .space-y-2 > div')) {
        const inputs = row.querySelectorAll('input')
        if (inputs.length === 2) out.push([inputs[0].value, inputs[1].value])
      }
      return out
    })
    console.log(`     got ${rows.length} rows (source had ${EXPECTED.length})`)
    rows.slice(0, 12).forEach(([t, d]) => console.log(`       "${t}"  |  "${d}"`))
    const norm = (s) => s.toLowerCase().replace(/[^a-zа-яё]/gi, '')
    let exact = 0, close = 0
    for (const [et, ed] of EXPECTED) {
      const hit = rows.find((r) => norm(r[0]) === norm(et))
      if (hit) { exact++; if (norm(hit[1]) === norm(ed)) close++ }
    }
    console.log(`     terms matched exactly: ${exact}/${EXPECTED.length}, with correct translation: ${close}/${EXPECTED.length}`)
    if (close < EXPECTED.length * 0.7) throw new Error(`only ${close}/${EXPECTED.length} pairs correct`)
  })

  await step('creating the module works', async () => {
    await page.locator('#import-title').fill('OCR тест')
    await page.getByRole('button', { name: /Создать модуль/ }).click()
    await page.waitForURL(/\/set\//, { timeout: 20000 })
    const count = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('quizmaster.state.v1'))
      return s.sets.find((x) => x.title === 'OCR тест')?.terms.length ?? 0
    })
    console.log('     stored cards:', count)
    if (count < 7) throw new Error('too few cards stored: ' + count)
  })

  console.log('\nerrors: ' + errs.length)
  errs.slice(0, 5).forEach((e) => console.log('  ' + e))
  await b.close()
})()
