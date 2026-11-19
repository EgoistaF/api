import { ARTIFACTS, BASE, chromium, devices, finish, note, seedCourse, step } from "../helpers.mjs"
;(async () => {
  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  const errs = []
  page.on('console', (m) => { if (m.type() === 'error' && !/_vercel|Failed to load resource/.test(m.text())) errs.push('C:' + m.text().slice(0,200)) })
  page.on('pageerror', (e) => errs.push('P:' + e.message.slice(0,200)))
  
  // simulate the user: create a folder named Deutsch first
  await step('create folder "Deutsch" in library', async () => {
    await page.goto(BASE + '/library', { waitUntil: 'networkidle' })
    await page.getByRole('tab', { name: 'Папки' }).click()
    await page.getByRole('button', { name: /Новая папка/ }).click()
    await page.locator('#folder-name').fill('Deutsch')
    await page.getByRole('button', { name: 'Создать' }).click()
    await page.waitForSelector('text=Папка создана', { timeout: 5000 })
  })

  await step('catalog preselects the Deutsch folder', async () => {
    await page.goto(BASE + '/catalog', { waitUntil: 'networkidle' })
    await page.waitForSelector('text=Готовый курс немецкого')
    const trigger = page.locator('button[role="combobox"]').first()
    const txt = await trigger.innerText()
    if (!/Deutsch/.test(txt)) throw new Error('folder not preselected, got: ' + txt)
  })
  await page.screenshot({ path: ARTIFACTS + '/cat-01.png', fullPage: false })

  await step('counts shown for all five levels', async () => {
    const body = await page.locator('body').innerText()
    for (const lvl of ['A1','A2','B1','B2','C1']) {
      if (!body.includes(lvl)) throw new Error('level missing: ' + lvl)
    }
    if (!/39 модулей/.test(body)) throw new Error('module total missing')
    if (!/1786 карточек/.test(body)) throw new Error('card total missing: ' + (body.match(/\d+ карточек/)||[])[0])
  })

  await step('add the whole course', async () => {
    await page.getByRole('button', { name: /Добавить 39 модулей/ }).click()
    await page.waitForURL(/\/folder\//, { timeout: 10000 })
    await page.waitForSelector('text=Deutsch')
    const body = await page.locator('body').innerText()
    if (!/39 модулей/.test(body)) throw new Error('folder does not show 39 sets: ' + body.slice(0,200))
  })
  await page.screenshot({ path: ARTIFACTS + '/cat-02-folder.png', fullPage: false })

  await step('a German set opens and studies', async () => {
    await page.locator('a[href^="/set/"]').first().click()
    await page.waitForURL(/\/set\/[^/]+$/, { timeout: 10000 })
    await page.waitForSelector('text=Освоено материала')
    const url = page.url()
    await page.goto(url + '/learn', { waitUntil: 'networkidle' })
    await page.waitForSelector('text=Заучивание · раунд 1', { timeout: 10000 })
    await page.locator('div.grid > button').first().click()
    await page.waitForTimeout(800)
  })
  await page.screenshot({ path: ARTIFACTS + '/cat-03-learn.png' })

  await step('re-adding skips duplicates', async () => {
    await page.goto(BASE + '/catalog', { waitUntil: 'networkidle' })
    const body = await page.locator('body').innerText()
    const already = (body.match(/уже в библиотеке/g) || []).length
    if (already !== 39) throw new Error('expected 39 "already" markers, got ' + already)
    await page.getByRole('button', { name: /Добавить 39 модулей/ }).click()
    await page.waitForSelector('text=Все выбранные модули уже есть', { timeout: 5000 })
  })

  await step('German TTS language is set on the sets', async () => {
    const lang = await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('quizmaster.state.v1'))
      const s = raw.sets.find((x) => x.title.startsWith('A1 ·'))
      return s ? s.termLang + '/' + s.defLang : 'none'
    })
    if (lang !== 'de-DE/ru-RU') throw new Error('wrong languages: ' + lang)
  })

  await step('total cards landed in storage', async () => {
    const n = await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('quizmaster.state.v1'))
      return raw.sets.filter((s) => /^(A1|A2|B1|B2|C1) ·/.test(s.title)).reduce((a, s) => a + s.terms.length, 0)
    })
    console.log('     cards stored:', n)
    if (n !== 1786) throw new Error('expected 1786 cards, got ' + n)
  })

  // mobile
  await step('catalog on mobile without overflow', async () => {
    const m = await b.newContext({ ...devices['iPhone 13'] })
    const mp = await m.newPage()
    await mp.goto(BASE + '/catalog', { waitUntil: 'networkidle' })
    await mp.screenshot({ path: ARTIFACTS + '/cat-04-mobile.png' })
    const sw = await mp.evaluate(() => document.documentElement.scrollWidth)
    const cw = await mp.evaluate(() => document.documentElement.clientWidth)
    if (sw > cw + 2) throw new Error(`overflow ${sw} > ${cw}`)
    await m.close()
  })

  console.log('\nerrors: ' + errs.length)
  errs.slice(0,5).forEach(e => console.log(e))
  await b.close()
})()
