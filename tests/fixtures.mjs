import path from "node:path"
import { ARTIFACTS, chromium } from "./helpers.mjs"

/** The pairs the generated word-list image contains. */
export const WORD_LIST = [
  ["die Wohnung", "квартира"],
  ["der Schlüssel", "ключ"],
  ["das Fenster", "окно"],
  ["die Treppe", "лестница"],
  ["der Kühlschrank", "холодильник"],
  ["die Waschmaschine", "стиральная машина"],
  ["das Erdgeschoss", "первый этаж"],
  ["die Miete", "арендная плата"],
  ["der Vermieter", "арендодатель"],
  ["umziehen", "переезжать"],
]

/**
 * Draws a two-column word list and saves it as a PNG, standing in for the
 * screenshot a learner would take of a flashcard app.
 */
export async function makeWordListImage() {
  const file = path.join(ARTIFACTS, "wordlist.png")
  const browser = await chromium.launch()
  const page = await (await browser.newContext({ viewport: { width: 760, height: 900 }, deviceScaleFactor: 2 })).newPage()
  await page.setContent(`<html><body style="margin:0;background:#fff;font-family:system-ui,Arial;padding:24px">
    ${WORD_LIST.map(([term, definition]) => `<div style="display:flex;border-bottom:1px solid #e5e5e5;padding:16px 8px">
      <div style="flex:1;font-size:22px;color:#111">${term}</div>
      <div style="flex:1;font-size:22px;color:#444">${definition}</div></div>`).join("")}
  </body></html>`)
  await page.screenshot({ path: file, fullPage: true })
  await browser.close()
  return file
}
