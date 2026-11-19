import { ARTIFACTS, BASE, chromium, devices, finish, note, seedCourse, step } from "../helpers.mjs"

;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()) })
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

  await step('a fresh browser starts empty and offers the catalogue', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)
    const sets = await page.evaluate(() => JSON.parse(localStorage.getItem('quizmaster.state.v1') || '{"sets":[]}').sets.length)
    if (sets !== 0) throw new Error('expected an empty library, got ' + sets + ' sets')
    await page.getByRole('main').getByRole('link', { name: /Готовый курс|курс немецкого/ }).first().click()
    await page.waitForURL(/\/catalog/, { timeout: 10000 })
  })

  await step('home shows the modules once the course is added', async () => {
    await page.getByRole('button', { name: /Добавить 39 модулей/ }).click()
    await page.waitForURL(/\/folder\/|\/library/, { timeout: 25000 })
    await page.goto(BASE, { waitUntil: 'networkidle' })
    await page.waitForSelector('text=Недавние модули', { timeout: 10000 })
    const cards = await page.locator('a[href^="/set/"]').count()
    if (cards < 4) throw new Error('expected module cards, got ' + cards)
  })
  await page.screenshot({ path: ARTIFACTS + '/01-home.png', fullPage: false })

  await step('open first set', async () => {
    await page.locator('h2:has-text("Недавние модули")').scrollIntoViewIfNeeded()
    await page.locator('a[href^="/set/"]:not([href*="/learn"]):not([href*="/flashcards"])').first().click()
    await page.waitForURL(/\/set\/[^/]+$/, { timeout: 10000 })
    await page.waitForSelector('text=Освоено материала')
  })
  const setUrl = page.url()
  if (!/\/set\/[^/]+$/.test(setUrl)) throw new Error('bad setUrl ' + setUrl)
  await page.screenshot({ path: ARTIFACTS + '/02-set.png', fullPage: false })

  await step('flashcards: flip + know', async () => {
    await page.goto(setUrl + '/flashcards', { waitUntil: 'networkidle' })
    await page.waitForSelector('text=Карточка 1 из')
    await page.keyboard.press('Space')
    await page.waitForTimeout(600)
    await page.getByRole('button', { name: 'Знаю' }).click()
    await page.waitForSelector('text=Карточка 2 из', { timeout: 5000 })
  })
  await page.screenshot({ path: ARTIFACTS + '/03-flashcards.png' })

  await step('learn: answer a choice question', async () => {
    await page.goto(setUrl + '/learn', { waitUntil: 'networkidle' })
    await page.waitForSelector('text=Заучивание · раунд 1')
    await page.waitForTimeout(400)
    await page.locator('div.grid > button').first().click()
    await page.waitForTimeout(900)
  })
  await page.screenshot({ path: ARTIFACTS + '/04-learn.png' })

  await step('write: submit wrong answer then next', async () => {
    await page.goto(setUrl + '/write', { waitUntil: 'networkidle' })
    await page.waitForSelector('text=Письмо ·')
    await page.locator('input').first().fill('заведомо неверно')
    await page.keyboard.press('Enter')
    await page.waitForSelector('text=Правильный ответ:', { timeout: 5000 })
    await page.getByRole('button', { name: /Дальше/ }).click()
  })
  await page.screenshot({ path: ARTIFACTS + '/05-write.png' })

  await step('test: setup -> grade', async () => {
    await page.goto(setUrl + '/test', { waitUntil: 'networkidle' })
    await page.waitForSelector('text=Настройте тест')
    // The default must survive the store loading: it used to collapse to one.
    const setup = await page.locator('main').innerText()
    const asked = Number((setup.match(/Количество вопросов\s+(\d+)/) || [])[1])
    note('default question count: ' + asked)
    if (!(asked > 1)) throw new Error('question count collapsed to ' + asked)
    await page.getByRole('button', { name: 'Начать тест' }).click()
    await page.waitForSelector('text=Проверить ответы', { timeout: 8000 })
    await page.screenshot({ path: ARTIFACTS + '/06-test.png', fullPage: true })
    await page.getByRole('button', { name: 'Проверить ответы' }).click()
    await page.waitForSelector('text=Верно', { timeout: 8000 })
  })
  await page.screenshot({ path: ARTIFACTS + '/07-test-result.png' })

  await step('match: play full game', async () => {
    await page.goto(setUrl + '/match', { waitUntil: 'networkidle' })
    await page.waitForSelector('text=Игра «Подбор»')
    await page.getByRole('button', { name: /Начать игру/ }).click()
    await page.waitForSelector('text=осталось пар', { timeout: 8000 })
    await page.screenshot({ path: ARTIFACTS + '/08-match.png' })
    // solve the board by reading tile texts and pairing them against the set
    for (let guard = 0; guard < 60; guard++) {
      const tiles = page.locator('main button:not([disabled])')
      const n = await tiles.count()
      if (n === 0) break
      let solvedOne = false
      const texts = []
      for (let i = 0; i < n; i++) texts.push((await tiles.nth(i).innerText()).trim())
      // brute force: try pairs until one sticks
      outer: for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const before = await page.locator('main button:not([disabled])').count()
          await page.locator('main button:not([disabled])').nth(i).click()
          await page.locator('main button:not([disabled])').nth(j).click()
          await page.waitForTimeout(260)
          const after = await page.locator('main button:not([disabled])').count()
          if (after < before) { solvedOne = true; break outer }
          await page.waitForTimeout(350)
        }
      }
      if (!solvedOne) break
      if (await page.locator('text=Готово!').count() || await page.locator('text=Новый рекорд!').count()) break
    }
    await page.waitForSelector('text=/Готово!|Новый рекорд!/', { timeout: 20000 })
    await page.screenshot({ path: ARTIFACTS + '/08b-match-done.png' })
  })

  await step('create set with bulk import', async () => {
    await page.goto(BASE + '/create', { waitUntil: 'networkidle' })
    await page.locator('#title').fill('QA тестовый модуль')
    await page.getByRole('button', { name: /^Импорт$/ }).click()
    await page.waitForSelector('text=Импорт данных')
    await page.locator('textarea').first().fill('alpha - первый\nbeta - второй\ngamma - третий')
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: /Импортировать/ }).click()
    await page.waitForTimeout(500)
    await page.getByRole('main').getByRole('button', { name: 'Создать модуль' }).click()
    await page.waitForURL(/\/set\//, { timeout: 8000 })
    await page.waitForSelector('text=QA тестовый модуль')
    const txt = await page.locator('body').innerText()
    if (!txt.includes('alpha')) throw new Error('imported term missing')
  })
  await page.screenshot({ path: ARTIFACTS + '/09-created.png' })

  await step('library + folders tab', async () => {
    await page.goto(BASE + '/library', { waitUntil: 'networkidle' })
    await page.getByRole('tab', { name: 'Папки' }).click()
    await page.waitForSelector('text=Новая папка')
  })
  await page.screenshot({ path: ARTIFACTS + '/10-library.png' })

  await step('search finds terms', async () => {
    await page.goto(BASE + '/search?q=Wohnung', { waitUntil: 'networkidle' })
    await page.waitForSelector('text=Найдено:')
    const txt = await page.locator('body').innerText()
    if (!txt.includes('квартира')) throw new Error('search did not find a course term')
  })

  await step('stats page', async () => {
    await page.goto(BASE + '/stats', { waitUntil: 'networkidle' })
    await page.waitForSelector('text=Ваш прогресс')
    const txt = await page.locator('body').innerText()
    if (!/Ответов дано/.test(txt)) throw new Error('stats missing')
  })
  await page.screenshot({ path: ARTIFACTS + '/11-stats.png' })

  await step('persistence across reload', async () => {
    await page.goto(BASE + '/library', { waitUntil: 'networkidle' })
    const txt = await page.locator('body').innerText()
    if (!txt.includes('QA тестовый модуль')) throw new Error('created set lost after reload')
  })

  await step('dark theme', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /тёмную тему|светлую тему/ }).click()
    await page.waitForTimeout(500)
    const cls = await page.locator('html').getAttribute('class')
    if (!cls || !cls.includes('dark')) throw new Error('dark class not applied: ' + cls)
  })
  await page.screenshot({ path: ARTIFACTS + '/12-dark.png' })

  await step('mobile layout', async () => {
    const mobile = await browser.newContext({ ...devices['iPhone 13'] })
    const mp = await mobile.newPage()
    await mp.goto(BASE, { waitUntil: 'networkidle' })
    await mp.screenshot({ path: ARTIFACTS + '/13-mobile.png', fullPage: false })
    const scrollW = await mp.evaluate(() => document.documentElement.scrollWidth)
    const clientW = await mp.evaluate(() => document.documentElement.clientWidth)
    if (scrollW > clientW + 2) throw new Error(`horizontal overflow: ${scrollW} > ${clientW}`)
    await mobile.close()
  })

  console.log('\n--- console/page errors (' + errors.length + ') ---')
  errors.slice(0, 20).forEach((e) => console.log(e))
  await browser.close()
})()
