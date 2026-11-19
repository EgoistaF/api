import { ARTIFACTS, BASE, chromium, devices, finish, note, seedCourse, step } from "../helpers.mjs"
const LOCAL = !process.env.BASE
;(async () => {
  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: 420, height: 900 } })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push('P:' + e.message.slice(0, 200)))
  
  await step('home renders with the new sections', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' })
    await page.waitForSelector('text=Тренажёр артиклей')
    const body = await page.locator('body').innerText()
    if (!/Повторение по расписанию|К повторению/.test(body)) throw new Error('review card missing')
  })

  await step('app still works when the account API is unreachable', async () => {
    if (!LOCAL) return
    const body = await page.locator('body').innerText()
    if (/Ошибка|Error|undefined/.test(body)) throw new Error('error surfaced to the user: ' + body.slice(0, 200))
  })

  await step('add the German course', async () => {
    await page.goto(BASE + '/catalog', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /Добавить 39 модулей/ }).click()
    await page.waitForURL(/\/folder\/|\/library/, { timeout: 15000 })
  })

  await step('article trainer collects nouns and grades', async () => {
    await page.goto(BASE + '/articles', { waitUntil: 'networkidle' })
    await page.waitForSelector('text=Тренажёр артиклей')
    const body = await page.locator('body').innerText()
    const m = body.match(/Доступно существительных: (\d+)/)
    if (!m) throw new Error('pool count missing')
    const pool = Number(m[1])
    console.log('     nouns found:', pool)
    if (pool < 50) throw new Error('too few nouns: ' + pool)
    await page.getByRole('button', { name: /Начать/ }).click()
    await page.waitForSelector('text=Клавиши 1, 2, 3', { timeout: 8000 })
    const before = await page.locator('body').innerText()
    if (!/1 \/ 20/.test(before)) throw new Error('counter missing: ' + before.slice(0, 150))
    let right = 0, wrong = 0
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press(String((i % 3) + 1))
      await page.waitForTimeout(1800)
      const t = await page.locator('body').innerText()
      right = Number((t.match(/Верно: (\d+)/) || [])[1] ?? 0)
      wrong = Number((t.match(/Ошибок: (\d+)/) || [])[1] ?? 0)
    }
    console.log('     after 5 answers -> correct', right, 'wrong', wrong)
    if (right + wrong !== 5) throw new Error('scoreboard did not track 5 answers: ' + (right + wrong))
  })
  await page.screenshot({ path: ARTIFACTS + '/nf-articles.png' })

  await step('review page: new cards queue works', async () => {
    await page.goto(BASE + '/review', { waitUntil: 'networkidle' })
    await page.waitForSelector('text=Повторение по расписанию')
    const body = await page.locator('body').innerText()
    if (!/Новые карточки/.test(body)) throw new Error('fresh queue missing')
    await page.getByRole('button', { name: /Выучить 20 новых/ }).click()
    await page.waitForSelector('text=/Выберите перевод|Введите перевод/', { timeout: 8000 })
    // answer one
    await page.locator('div.grid > button').first().click()
    await page.waitForTimeout(900)
  })
  await page.screenshot({ path: ARTIFACTS + '/nf-review.png' })

  await step('answering makes cards due later, not immediately', async () => {
    await page.goto(BASE + '/review', { waitUntil: 'networkidle' })
    await page.waitForSelector('text=К повторению сейчас')
    const text = await page.locator('body').innerText()
    const due = Number((text.match(/К повторению сейчас\s+(\d+)/) || [])[1])
    console.log('     due right after answering:', due)
    if (due !== 0) throw new Error('queue should be empty right after answering, got ' + due)
    if (!/Следующее повторение через/.test(text)) throw new Error('next-due time not shown')
  })

  await step('account page renders both tabs', async () => {
    await page.goto(BASE + '/account', { waitUntil: 'networkidle' })
    await page.getByRole('main').getByRole('heading', { name: 'Профиль' }).waitFor({ timeout: 15000 })
    await page.getByRole('tab', { name: 'Вход' }).click()
    await page.waitForSelector('#login-username')
  })
  await page.screenshot({ path: ARTIFACTS + '/nf-account.png' })

  await step('no horizontal overflow on the new pages', async () => {
    for (const path of ['/review', '/articles', '/account']) {
      await page.goto(BASE + path, { waitUntil: 'networkidle' })
      const sw = await page.evaluate(() => document.documentElement.scrollWidth)
      const cw = await page.evaluate(() => document.documentElement.clientWidth)
      if (sw > cw + 2) throw new Error(`${path}: ${sw} > ${cw}`)
    }
  })

  console.log('\nerrors: ' + errs.length)
  errs.slice(0, 5).forEach((e) => console.log(e))
  await b.close()
})()
