import { writeFileSync } from "node:fs"
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

/** The four-column verb table the photo fixture contains. */
export const VERB_TABLE = [
  ["beginnen", "begann", "begonnen", "начинать"],
  ["bleiben", "blieb", "geblieben", "оставаться"],
  ["essen", "aß", "gegessen", "есть"],
  ["fahren", "fuhr", "gefahren", "ехать на транспорте"],
  ["fallen", "fiel", "gefallen", "падать"],
  ["finden", "fand", "gefunden", "находить"],
  ["geben", "gab", "gegeben", "давать"],
  ["gehen", "ging", "gegangen", "идти"],
  ["helfen", "half", "geholfen", "помогать"],
  ["kommen", "kam", "gekommen", "приходить"],
  ["lesen", "las", "gelesen", "читать"],
  ["nehmen", "nahm", "genommen", "брать"],
  ["schlafen", "schlief", "geschlafen", "спать"],
  ["schreiben", "schrieb", "geschrieben", "писать"],
  ["sehen", "sah", "gesehen", "видеть"],
  ["sprechen", "sprach", "gesprochen", "говорить"],
]

/**
 * Draws the verb table, then photographs it badly: shrunk, tilted, lit from
 * one corner, noisy and saved as a middling JPEG. This is the hard case —
 * a table of four columns under a title, shot off a screen with a phone.
 */
export async function makeVerbTablePhoto() {
  const file = path.join(ARTIFACTS, "verb-table.jpg")
  const browser = await chromium.launch()
  const page = await (await browser.newContext({ viewport: { width: 1000, height: 900 } })).newPage()
  await page.setContent(`<html><body style="margin:0;background:#fffaf2;color:#1a1a2e;font-family:system-ui,Arial;padding:28px">
    <h1 style="text-align:center;font-size:40px;margin:6px 0">Starke Verben</h1>
    <p style="text-align:center;color:#777;font-size:17px;margin:0 0 20px">Infinitiv • Präteritum • Partizip II • Russisch</p>
    <table style="width:100%;border-collapse:collapse;font-size:20px">
      <thead><tr style="background:#14142b;color:#fff">
        ${["Infinitiv", "Präteritum", "Partizip II", "Russisch"].map((head) => `<th style="text-align:left">${head}</th>`).join("")}
      </tr></thead>
      <tbody>${VERB_TABLE.map(
        (row, index) =>
          `<tr style="background:${index % 2 ? "#fff" : "#fdf0e3"}">${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`,
      ).join("")}</tbody>
    </table>
    <style>td,th{padding:9px 10px}</style></body></html>`)
  const shot = (await page.screenshot({ fullPage: true })).toString("base64")
  const jpeg = await page.evaluate(async (source) => {
    const image = new Image()
    image.src = "data:image/png;base64," + source
    await image.decode()
    const width = Math.round(image.width * 0.62)
    const height = Math.round(image.height * 0.62)
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext("2d")
    context.imageSmoothingQuality = "high"
    context.translate(width / 2, height / 2)
    context.rotate(0.012)
    context.translate(-width / 2, -height / 2)
    context.drawImage(image, 0, 0, width, height)
    context.setTransform(1, 0, 0, 1, 0, 0)
    const light = context.createLinearGradient(0, 0, width, height)
    light.addColorStop(0, "rgba(255,255,255,0.45)")
    light.addColorStop(0.45, "rgba(255,255,255,0)")
    light.addColorStop(1, "rgba(0,0,0,0.42)")
    context.fillStyle = light
    context.fillRect(0, 0, width, height)
    const pixels = context.getImageData(0, 0, width, height)
    for (let i = 0; i < pixels.data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 14
      pixels.data[i] += noise
      pixels.data[i + 1] += noise
      pixels.data[i + 2] += noise
    }
    context.putImageData(pixels, 0, 0)
    return canvas.toDataURL("image/jpeg", 0.6).split(",")[1]
  }, shot)
  writeFileSync(file, Buffer.from(jpeg, "base64"))
  await browser.close()
  return file
}
