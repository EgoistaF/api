import { ARTIFACTS, BASE, chromium, devices, finish, note, seedCourse, step } from "../helpers.mjs"
;(async () => {
  const b = await chromium.launch()
  const ctx = await b.newContext({ ...devices['iPhone 13'] })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
  
  await step('registering either works, or explains that the service is down', async () => {
    await page.goto(BASE + '/account', { waitUntil: 'networkidle' })
    const name = 'probe' + Date.now().toString(36)
    await page.locator('#register-username').fill(name)
    await page.locator('#register-password').fill('test-pass-123')
    await page.locator('#repeat').fill('test-pass-123')
    await page.locator('form').getByRole('button', { name: 'Создать профиль' }).click()

    // Success sends you to the home page; failure keeps you on the form.
    const failed = page.locator('form p.text-destructive')
    await Promise.race([
      page.waitForURL(BASE + '/', { timeout: 25000 }).catch(() => null),
      failed.waitFor({ timeout: 25000 }).catch(() => null),
    ])

    if (!(await failed.count())) {
      const me = await page.evaluate(() => fetch('/api/auth/me').then((r) => r.json()).catch(() => null))
      if (me?.user?.username !== name) throw new Error('no error shown but not signed in either')
      note('profile service is up: registered and signed in as ' + me.user.username)
      await page.goto(BASE + '/account', { waitUntil: 'networkidle' })
      if (!(await page.getByRole('button', { name: /Синхронизировать сейчас/ }).count())) {
        throw new Error('signed in but the profile screen offers no sync controls')
      }
      return
    }

    const text = (await failed.innerText()).trim()
    note('profile service is down: ' + text)
    if (!text) throw new Error('neither signed in nor told why')
    // Whatever the wording, the user must not be blamed for an outage.
    if (/неверн/i.test(text)) throw new Error('outage reported as bad credentials: ' + text)
    if (/недоступ/i.test(text) && !(await page.locator('text=Сервис профилей сейчас недоступен').count())) {
      throw new Error('outage message shown but the banner never appeared')
    }
  })

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
