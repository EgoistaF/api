import { ARTIFACTS, BASE, chromium, devices, finish, note, seedCourse, step } from "../helpers.mjs"
// A purpose-built set reproducing exactly the four cards from the screenshots.
const CARDS = [
  ['verheiratet', 'женат / замужем'],
  ['geschieden', 'разведён / разведена'],
  ['Ich komme aus …', 'я из …'],
  ['Ich wohne in …', 'я живу в …'],
]

;(async () => {
  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: 420, height: 880 } })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push('P:' + e.message.slice(0, 200)))
  
  await page.goto(BASE, { waitUntil: 'networkidle' })

  // seed a dedicated set straight into storage, then reload
  await page.evaluate((cards) => {
    const key = 'quizmaster.state.v1'
    const state = JSON.parse(localStorage.getItem(key))
    state.sets.unshift({
      id: 'set_qa_answers',
      title: 'QA · проверка ответов',
      description: '',
      folderId: null,
      createdAt: Date.now(), updatedAt: Date.now(),
      termLang: 'de-DE', defLang: 'ru-RU', author: 'you',
      terms: cards.map(([term, definition], i) => ({ id: 't_qa_' + i, term, definition, starred: false })),
    })
    localStorage.setItem(key, JSON.stringify(state))
  }, CARDS)

  // force written questions so every card is typed
  await page.evaluate(() => {
    const key = 'quizmaster.state.v1'
    const state = JSON.parse(localStorage.getItem(key))
    state.settings.learnMode = 'written'
    localStorage.setItem(key, JSON.stringify(state))
  })

  const answerAndRead = async (text) => {
    await page.locator('input').first().fill(text)
    await page.keyboard.press('Enter')
    await page.waitForSelector('text=/Верно!|Почти — опечатка|Правильный ответ:/', { timeout: 6000 })
    const banner = await page.locator('div.animate-pop-in').first().innerText()
    const verdict = /Верно!/.test(banner) ? 'correct' : /Почти/.test(banner) ? 'typo' : 'wrong'
    return verdict
  }

  const prompts = new Map(CARDS)

  await step('all four screenshot cards accept the full answer', async () => {
    await page.goto(BASE + '/set/set_qa_answers/learn', { waitUntil: 'networkidle' })
    await page.waitForSelector('text=Заучивание · раунд 1')
    const seen = new Set()
    for (let i = 0; i < 4; i++) {
      const prompt = (await page.locator('p.text-2xl').first().innerText()).trim()
      const expected = prompts.get(prompt)
      if (!expected) throw new Error('unexpected prompt: ' + prompt)
      seen.add(prompt)
      // type the answer exactly as the card shows it
      const verdict = await answerAndRead(expected)
      if (verdict !== 'correct') throw new Error(`"${expected}" graded ${verdict}`)
      await page.getByRole('button', { name: /Дальше/ }).click()
      await page.waitForTimeout(250)
    }
    if (seen.size !== 4) throw new Error('only saw ' + seen.size + ' distinct cards')
  })

  await step('answers typed without the slash / ellipsis are accepted', async () => {
    await page.goto(BASE + '/set/set_qa_answers/write', { waitUntil: 'networkidle' })
    await page.waitForSelector('text=Письмо ·')
    const variants = {
      'женат / замужем': 'женат замужем',
      'разведён / разведена': 'разведён разведена',
      'я из …': 'я из',
      'я живу в …': 'я живу в',
    }
    for (let i = 0; i < 4; i++) {
      const prompt = (await page.locator('p.text-2xl').first().innerText()).trim()
      const expected = prompts.get(prompt)
      const verdict = await answerAndRead(variants[expected])
      if (verdict !== 'correct') throw new Error(`"${variants[expected]}" for "${expected}" graded ${verdict}`)
      await page.getByRole('button', { name: /Дальше/ }).click()
      await page.waitForTimeout(250)
    }
  })

  await step('the typo from the screenshot counts as "почти"', async () => {
    await page.goto(BASE + '/set/set_qa_answers/write', { waitUntil: 'networkidle' })
    await page.waitForSelector('text=Письмо ·')
    for (let i = 0; i < 4; i++) {
      const prompt = (await page.locator('p.text-2xl').first().innerText()).trim()
      if (prompts.get(prompt) === 'разведён / разведена') {
        const verdict = await answerAndRead('резведён / разведена')
        if (verdict !== 'typo') throw new Error('graded ' + verdict + ', expected typo')
        await page.screenshot({ path: ARTIFACTS + '/ans-typo.png' })
        return
      }
      await page.locator('input').first().fill('x')
      await page.keyboard.press('Enter')
      await page.getByRole('button', { name: /Дальше/ }).click()
      await page.waitForTimeout(250)
    }
    throw new Error('card not reached')
  })

  await step('a format hint is shown before answering', async () => {
    await page.goto(BASE + '/set/set_qa_answers/write', { waitUntil: 'networkidle' })
    await page.waitForSelector('text=Письмо ·')
    const body = await page.locator('body').innerText()
    if (!/Достаточно одного варианта|Многоточие в конце|Текст в скобках/.test(body)) {
      throw new Error('no hint rendered: ' + body.slice(0, 300))
    }
    await page.screenshot({ path: ARTIFACTS + '/ans-hint.png' })
  })

  await step('a plainly wrong answer is still wrong', async () => {
    const verdict = await answerAndRead('собака')
    if (verdict !== 'wrong') throw new Error('graded ' + verdict)
  })

  console.log('\nerrors: ' + errs.length)
  errs.slice(0, 5).forEach((e) => console.log(e))
  await b.close()
})()
