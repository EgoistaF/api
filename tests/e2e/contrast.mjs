import { ARTIFACTS, BASE, chromium, devices, finish, note, seedCourse, step } from "../helpers.mjs"
/** Relative luminance contrast, as WCAG defines it. */
function contrast(a, b) {
  const lum = (c) => {
    const [r, g, bl] = c.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 })
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}
const parse = (s) => (s.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number)

;(async () => {
  const b = await chromium.launch()
  const ctx = await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))

  // seed the German course so pages have real content
  await page.goto(BASE + '/catalog', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Добавить 39 модулей/ }).click().catch(() => {})
  await page.waitForTimeout(2500)

  const PAGES = ['/', '/library', '/review', '/articles', '/catalog', '/stats', '/settings', '/account', '/search?q=Haus']
  let lowContrast = 0
  let unmeasured = 0

  for (const mode of ['light', 'dark']) {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' })
    await page.evaluate((m) => {
      localStorage.setItem('theme', m)
      document.documentElement.classList.toggle('dark', m === 'dark')
    }, mode)

    for (const path of PAGES) {
      await page.goto(BASE + path, { waitUntil: 'networkidle' })
      await page.evaluate((m) => document.documentElement.classList.toggle('dark', m === 'dark'), mode)
      await page.waitForTimeout(700)
      const name = path.replace(/[/?=]/g, '_') || '_home'
      await page.screenshot({ path: `${ARTIFACTS}/berlin-${mode}${name}.png`, fullPage: true })

      // flag any visible text that fails WCAG AA for normal text
      const bad = await page.evaluate(() => {
        const out = []
        for (const el of document.querySelectorAll('body *')) {
          if (!el.childNodes.length) continue
          const text = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('')
          if (!text || text.length < 2) continue
          const r = el.getBoundingClientRect()
          if (r.width < 4 || r.height < 4) continue
          const cs = getComputedStyle(el)
          if (cs.visibility === 'hidden' || cs.opacity === '0') continue
          // Walk up until an opaque plain rgb() background is found; anything
          // layered on top is semi-transparent and measured separately.
          let bg = null, translucent = false, node = el
          while (node) {
            const value = getComputedStyle(node).backgroundColor
            if (value && value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent') {
              if (/^rgb\(/.test(value)) { bg = value; break }
              translucent = true
            }
            node = node.parentElement
          }
          if (!bg) continue
          out.push({ text: text.slice(0, 40), fg: cs.color, bg, translucent, size: parseFloat(cs.fontSize), weight: cs.fontWeight })
        }
        return out
      })
      for (const item of bad) {
        if (item.translucent) { unmeasured++; continue }
        if (!/^rgb\(/.test(item.fg)) { unmeasured++; continue }
        const ratio = contrast(parse(item.fg), parse(item.bg))
        const large = item.size >= 24 || (item.size >= 18.66 && Number(item.weight) >= 700)
        if (ratio < (large ? 3 : 4.5)) {
          lowContrast++
          if (lowContrast <= 12) console.log(`  LOW ${ratio.toFixed(2)} ${mode}${path} "${item.text}" ${item.fg} on ${item.bg}`)
        }
      }
    }
  }

  console.log(`\nlow-contrast text nodes: ${lowContrast} (skipped as layered/translucent: ${unmeasured})`)
  console.log('page errors: ' + errs.length)
  errs.slice(0, 3).forEach((e) => console.log('  ' + e))
  await b.close()
})()
