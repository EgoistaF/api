import { ARTIFACTS, BASE, chromium, devices, finish, note, seedCourse, step } from "../helpers.mjs"
;(async () => {
  const b = await chromium.launch()
  const errs = []

  /* ---------- phone ---------- */
  const mob = await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 2 })
  const m = await mob.newPage()
  m.on('pageerror', (e) => errs.push('mobile: ' + e.message.slice(0, 140)))

  await step('phone: seed the course', async () => {
    await m.goto(BASE + '/catalog', { waitUntil: 'networkidle' })
    await m.getByRole('button', { name: /Добавить 39 модулей/ }).click()
    await m.waitForURL(/\/folder\/|\/library/, { timeout: 25000 })
  })

  await step('phone: tab bar shows five tabs, sidebar hidden', async () => {
    await m.goto(BASE + '/', { waitUntil: 'networkidle' })
    await m.waitForTimeout(600)
    const bar = m.locator('nav.fixed')
    const tabs = (await bar.locator('a').count()) + (await bar.locator('button').count())
    if (tabs !== 5) throw new Error('expected 5 tabs, got ' + tabs)
    if (await m.locator('aside').isVisible().catch(() => false)) throw new Error('sidebar visible on phone')
  })
  await m.screenshot({ path: ARTIFACTS + '/phone-home.png' })

  await step('phone: every tab navigates', async () => {
    for (const [label, url] of [['Повторение', '/review'], ['Библиотека', '/library'], ['Тренировки', '/drills'], ['Главная', '/']]) {
      await m.locator('nav.fixed').getByRole('link', { name: label }).click()
      await m.waitForURL(BASE + url, { timeout: 10000 })
    }
  })

  await step('phone: "Ещё" reaches the rest', async () => {
    await m.locator('nav.fixed').getByRole('button', { name: 'Ещё' }).click()
    const sheet = m.locator('[role="dialog"]')
    await sheet.waitFor({ state: 'visible', timeout: 8000 })
    for (const label of ['Каталог', 'Прогресс', 'Настройки']) {
      if (!(await sheet.getByRole('link', { name: label }).isVisible())) throw new Error('missing: ' + label)
    }
    await sheet.getByRole('link', { name: 'Прогресс' }).click()
    await m.waitForURL(BASE + '/stats', { timeout: 10000 })
  })
  await m.screenshot({ path: ARTIFACTS + '/phone-stats.png' })

  await step('phone: content is not hidden behind the tab bar', async () => {
    await m.goto(BASE + '/settings', { waitUntil: 'networkidle' })
    await m.waitForTimeout(500)
    await m.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await m.waitForTimeout(400)
    const clipped = await m.evaluate(() => {
      const bar = document.querySelector('nav.fixed')
      if (!bar) return 'no tab bar'
      const barTop = bar.getBoundingClientRect().top
      const last = document.querySelector('main')?.lastElementChild
      const el = last?.querySelector('p:last-child') ?? last
      if (!el) return null
      const r = el.getBoundingClientRect()
      return r.bottom > barTop + 1 ? `overlapped by ${Math.round(r.bottom - barTop)}px` : null
    })
    if (clipped) throw new Error(String(clipped))
  })

  await step('phone: study modes have no chrome at all', async () => {
    await m.goto(BASE + '/library', { waitUntil: 'networkidle' })
    const href = await m.locator('a[href^="/set/"]').first().getAttribute('href')
    await m.goto(BASE + href + '/learn', { waitUntil: 'networkidle' })
    await m.waitForSelector('text=Заучивание', { timeout: 15000 })
    if (await m.locator('nav.fixed').count()) throw new Error('tab bar visible in a study mode')
    if (await m.getByRole('button', { name: /Создать|Поиск/ }).count()) throw new Error('app header visible in a study mode')
    if (await m.locator('a[href="/"]:has-text("QuizMaster")').count()) throw new Error('app logo visible in a study mode')
  })
  await m.screenshot({ path: ARTIFACTS + '/phone-study.png' })

  await step('phone: review tab shows a badge once cards are due', async () => {
    await m.goto(BASE + '/', { waitUntil: 'networkidle' })
    await m.waitForTimeout(500)
    // make three cards overdue by backdating them past their interval
    await m.evaluate(() => {
      const key = 'quizmaster.state.v1'
      const s = JSON.parse(localStorage.getItem(key))
      const set = s.sets[0]
      const long_ago = Date.now() - 40 * 86400000
      s.progress[set.id] = { cards: {}, rounds: 0, lastStudied: long_ago, bestMatchTime: null, testHistory: [] }
      for (const t of set.terms.slice(0, 3)) {
        s.progress[set.id].cards[t.id] = { box: 1, correct: 1, incorrect: 0, streak: 1, lastSeen: long_ago, status: 'learning' }
      }
      localStorage.setItem(key, JSON.stringify(s))
    })
    await m.reload({ waitUntil: 'networkidle' })
    await m.waitForTimeout(900)
    const badge = (await m.locator('nav.fixed a[href="/review"] span.rounded-full').innerText()).trim()
    if (badge !== '3') throw new Error('badge should read 3, got "' + badge + '"')
  })

  /* ---------- desktop ---------- */
  const desk = await b.newContext({ viewport: { width: 1440, height: 900 } })
  const d = await desk.newPage()
  d.on('pageerror', (e) => errs.push('desktop: ' + e.message.slice(0, 140)))

  await step('desktop: seed the course', async () => {
    await d.goto(BASE + '/catalog', { waitUntil: 'networkidle' })
    await d.getByRole('button', { name: /Добавить 39 модулей/ }).click()
    await d.waitForURL(/\/folder\/|\/library/, { timeout: 25000 })
  })

  await step('desktop: sidebar shown, tab bar hidden', async () => {
    await d.goto(BASE + '/', { waitUntil: 'networkidle' })
    await d.waitForTimeout(600)
    if (!(await d.locator('aside').isVisible())) throw new Error('sidebar hidden on desktop')
    const barVisible = await d.locator('nav.fixed').isVisible().catch(() => false)
    if (barVisible) throw new Error('tab bar visible on desktop')
  })
  await d.screenshot({ path: ARTIFACTS + '/desktop-home.png' })

  await step('desktop: sidebar lists every destination', async () => {
    for (const label of ['Главная', 'Повторение', 'Библиотека', 'Тренировки', 'Каталог', 'Прогресс', 'Настройки']) {
      if (!(await d.locator('aside').getByRole('link', { name: label }).isVisible())) throw new Error('missing: ' + label)
    }
    await d.locator('aside').getByRole('link', { name: 'Тренировки' }).click()
    await d.waitForURL(BASE + '/drills', { timeout: 10000 })
  })
  await d.screenshot({ path: ARTIFACTS + '/desktop-drills.png' })

  await step('desktop: study modes drop the sidebar too', async () => {
    await d.goto(BASE + '/library', { waitUntil: 'networkidle' })
    const href = await d.locator('a[href^="/set/"]').first().getAttribute('href')
    await d.goto(BASE + href + '/match', { waitUntil: 'networkidle' })
    await d.waitForSelector('text=Подбор', { timeout: 15000 })
    if (await d.locator('aside').count()) throw new Error('sidebar visible in a study mode')
  })

  console.log('\npage errors: ' + errs.length)
  errs.slice(0, 4).forEach((e) => console.log('  ' + e))
  await b.close()
})()
