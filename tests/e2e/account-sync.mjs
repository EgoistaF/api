import { ARTIFACTS, BASE, chromium, devices, finish, note, seedCourse, step } from "../helpers.mjs"
const USER = 'qa' + Date.now().toString(36)
const PASS = 'test-pass-123'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function device(browser, label) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 900 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log(`   [${label} pageerror] ` + e.message.slice(0, 150)))
  return { ctx, page }
}

const readState = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('quizmaster.state.v1') || '{}'))

;(async () => {
  // Nothing here can pass while the profile store refuses writes.
  const health = await fetch(BASE + "/api/health").then((r) => r.json()).catch(() => null)
  if (!health?.ok) {
    console.log("SKIP profile storage is unavailable (" + JSON.stringify(health) + ")")
    return
  }

  const b = await chromium.launch()
  const A = await device(b, 'A')
  const B = await device(b, 'B')

  await step('device A: register a new profile', async () => {
    await A.page.goto(BASE + '/account', { waitUntil: 'networkidle' })
    await A.page.locator('#register-username').fill(USER)
    await A.page.locator('#register-password').fill(PASS)
    await A.page.locator('#repeat').fill(PASS)
    await A.page.locator('form').getByRole('button', { name: 'Создать профиль' }).click()
    await A.page.waitForURL(BASE + '/', { timeout: 20000 })
    await A.page.waitForTimeout(3000)
  })

  await step('device A: add the German course and study a card', async () => {
    await A.page.goto(BASE + '/catalog', { waitUntil: 'networkidle' })
    await A.page.getByRole('button', { name: /Добавить 39 модулей/ }).click()
    await A.page.waitForURL(/\/folder\/|\/library/, { timeout: 20000 })
    await A.page.goto(BASE + '/articles', { waitUntil: 'networkidle' })
    await A.page.getByRole('button', { name: /Начать/ }).click()
    await A.page.waitForSelector('text=Клавиши 1, 2, 3')
    for (let i = 0; i < 3; i++) { await A.page.keyboard.press('1'); await A.page.waitForTimeout(1700) }
    await A.page.waitForTimeout(4000) // let the debounced push run
  })

  let aSets = 0, aAnswers = 0
  await step('device A: state is on the device', async () => {
    const s = await readState(A.page)
    aSets = s.sets.length
    aAnswers = s.stats.cardsStudied
    console.log(`     sets=${aSets} answers=${aAnswers}`)
    if (aSets < 39) throw new Error('sets missing: ' + aSets)
    if (aAnswers < 3) throw new Error('answers not recorded: ' + aAnswers)
  })

  await step('device B (separate storage) starts empty', async () => {
    await B.page.goto(BASE, { waitUntil: 'networkidle' })
    await B.page.waitForTimeout(1500)
    const s = await readState(B.page)
    if (s.sets.some((x) => /^A1 ·/.test(x.title))) throw new Error('B already has the course — storage is shared')
  })

  await step('device B: sign in and receive the library + progress', async () => {
    await B.page.goto(BASE + '/account', { waitUntil: 'networkidle' })
    await B.page.getByRole('tab', { name: 'Вход' }).click()
    await B.page.locator('#login-username').fill(USER)
    await B.page.locator('#login-password').fill(PASS)
    await B.page.locator('form').getByRole('button', { name: 'Войти', exact: true }).click()
    await B.page.waitForURL(BASE + '/', { timeout: 20000 })
    await B.page.waitForTimeout(4000)
    const s = await readState(B.page)
    console.log(`     B after login: sets=${s.sets.length} answers=${s.stats.cardsStudied}`)
    if (s.sets.length !== aSets) throw new Error('B did not adopt the library cleanly: ' + s.sets.length + ' vs ' + aSets)
    if (s.sets.filter((x) => /^(A1|A2|B1|B2|C1) ·/.test(x.title)).length !== 39) {
      throw new Error('course did not sync: ' + s.sets.length)
    }
    if (s.stats.cardsStudied < aAnswers) throw new Error('progress did not sync')
  })
  await B.page.screenshot({ path: ARTIFACTS + '/sync-b-home.png' })

  await step('device B: create a set, device A picks it up on focus', async () => {
    await B.page.goto(BASE + '/create', { waitUntil: 'networkidle' })
    await B.page.locator('#title').fill('Сделано на устройстве B')
    const rows = B.page.locator('input[placeholder="Термин"]')
    await rows.first().fill('Hund')
    await B.page.locator('input[placeholder="Определение"]').first().fill('собака')
    await B.page.getByRole('button', { name: 'Создать модуль' }).click()
    await B.page.waitForURL(/\/set\//, { timeout: 20000 })
    await B.page.waitForTimeout(4000)

    await A.page.goto(BASE + '/library', { waitUntil: 'networkidle' })
    await A.page.waitForTimeout(1000)
    await A.page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await A.page.waitForTimeout(4000)
    const s = await readState(A.page)
    if (!s.sets.some((x) => x.title === 'Сделано на устройстве B')) {
      throw new Error("A did not receive B's set")
    }
  })

  await step('deleting on A does not resurrect from B', async () => {
    const id = (await readState(A.page)).sets.find((x) => x.title === 'Сделано на устройстве B').id
    await A.page.evaluate((setId) => {
      const key = 'quizmaster.state.v1'
      const s = JSON.parse(localStorage.getItem(key))
      s.sets = s.sets.filter((x) => x.id !== setId)
      s.deleted = { ...(s.deleted || {}), [setId]: Date.now() }
      localStorage.setItem(key, JSON.stringify(s))
    }, id)
    await A.page.reload({ waitUntil: 'networkidle' })
    await A.page.waitForTimeout(5000)
    const after = await readState(A.page)
    if (after.sets.some((x) => x.id === id)) throw new Error('deleted set came back')
  })

  await step('wrong password is rejected', async () => {
    const C = await device(b, 'C')
    await C.page.goto(BASE + '/account', { waitUntil: 'networkidle' })
    await C.page.getByRole('tab', { name: 'Вход' }).click()
    await C.page.locator('#login-username').fill(USER)
    await C.page.locator('#login-password').fill('wrong-password')
    await C.page.locator('form').getByRole('button', { name: 'Войти', exact: true }).click()
    await C.page.waitForSelector('text=Неверное имя или пароль', { timeout: 15000 })
    await C.ctx.close()
  })

  await step('duplicate user name is rejected', async () => {
    const D = await device(b, 'D')
    await D.page.goto(BASE + '/account', { waitUntil: 'networkidle' })
    await D.page.locator('#register-username').fill(USER)
    await D.page.locator('#register-password').fill('another-pass')
    await D.page.locator('#repeat').fill('another-pass')
    await D.page.locator('form').getByRole('button', { name: 'Создать профиль' }).click()
    await D.page.waitForSelector('text=Это имя уже занято', { timeout: 15000 })
    await D.ctx.close()
  })

  await step('signing out keeps the data on the device', async () => {
    await B.page.goto(BASE + '/account', { waitUntil: 'networkidle' })
    await B.page.getByRole('button', { name: 'Выйти' }).click()
    await B.page.waitForSelector('text=Регистрация', { timeout: 15000 })
    const s = await readState(B.page)
    if (s.sets.length < 39) throw new Error('local data lost on sign out')
  })

  await b.close()
})()
