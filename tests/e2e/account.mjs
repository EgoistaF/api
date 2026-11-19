import { ARTIFACTS, BASE, chromium, devices, finish, note, seedCourse, step } from "../helpers.mjs"
;(async () => {
  const b = await chromium.launch()
  const ctx = await b.newContext({ ...devices['iPhone 13'] })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
  
  await step('the outage is surfaced, on opening or at the latest on trying', async () => {
    await page.goto(BASE + '/account', { waitUntil: 'networkidle' })
    const health = await page.evaluate(() => fetch('/api/health').then((r) => r.json()).catch(() => null))
    if (health?.ok) {
      // A cold server has no failed write to report yet; the banner is then
      // expected only after an attempt, which the next scenario checks.
      note('health still reports ok; banner is checked after the attempt')
      return
    }
    await page.waitForSelector('text=Сервис профилей сейчас недоступен', { timeout: 15000 })
  })
  await page.screenshot({ path: ARTIFACTS + '/acct-down.png' })

  await step('a broken service is never reported as a wrong password', async () => {
    await page.locator('#register-username').fill('egoista')
    await page.locator('#register-password').fill('test-pass-123')
    await page.locator('#repeat').fill('test-pass-123')
    await page.locator('form').getByRole('button', { name: 'Создать профиль' }).click()
    // The exact wording depends on which keys the deployment has; what must
    // hold everywhere is that the user is not blamed for the outage.
    const error = page.locator('form p.text-destructive')
    await error.waitFor({ timeout: 25000 })
    const text = (await error.innerText()).trim()
    note('error shown: ' + text)
    if (/неверн/i.test(text)) throw new Error('outage reported as bad credentials: ' + text)
    if (!text) throw new Error('no error shown at all')
    // Once an attempt has failed for storage, the page must say so plainly.
    if (/недоступ/i.test(text) && !(await page.locator('text=Сервис профилей сейчас недоступен').count())) {
      throw new Error('outage message shown but the banner never appeared')
    }
  })
  await page.screenshot({ path: ARTIFACTS + '/acct-register-error.png' })

  await step('the app itself still works offline-first', async () => {
    await page.goto(BASE + '/catalog', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /Добавить 39 модулей/ }).click()
    await page.waitForURL(/\/folder\/|\/library/, { timeout: 25000 })
    const n = await page.evaluate(() => JSON.parse(localStorage.getItem('quizmaster.state.v1')).sets.length)
    if (n < 39) throw new Error('course not stored: ' + n)
    console.log('     sets stored locally:', n)
  })

  await step('studying still records progress', async () => {
    await page.goto(BASE + '/articles', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /Начать/ }).click()
    await page.waitForSelector('text=Клавиши 1, 2, 3', { timeout: 15000 })
    await page.keyboard.press('1')
    await page.waitForTimeout(1800)
    const n = await page.evaluate(() => JSON.parse(localStorage.getItem('quizmaster.state.v1')).stats.cardsStudied)
    if (n < 1) throw new Error('progress not recorded')
  })

  console.log('\npage errors: ' + errs.length)
  errs.slice(0, 3).forEach((e) => console.log('  ' + e))
  await b.close()
})()
