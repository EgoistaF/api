/**
 * Checks how recognized words are turned into cards, without running
 * recognition: the word boxes below are the shape of what the engine hands
 * back for a word list, laid out the way the real pages are.
 *
 * The browser suite reads real pictures end to end; this runs in a second and
 * guards the parsing itself.
 */
import { detectColumns, dropHeadings, harmonizeScripts, pairsFromLines } from "../lib/ocr.ts"

let failures = 0
function check(name, body) {
  try {
    body()
    console.log("OK   " + name)
  } catch (error) {
    failures++
    console.log("FAIL " + name + " :: " + (error?.message ?? error))
  }
}

const equal = (got, want, what) => {
  const a = JSON.stringify(got)
  const b = JSON.stringify(want)
  if (a !== b) throw new Error(`${what}\n       got  ${a}\n       want ${b}`)
}

/** Lays out cells at the given left edges, in the manner of a table. */
function line(cells, { drift = 0, height = 20, charWidth = 11 } = {}) {
  const words = []
  for (const [left, text] of cells) {
    let x = left + drift
    for (const word of text.split(" ")) {
      const width = word.length * charWidth
      words.push({ text: word, x0: x, x1: x + width, y0: 0, y1: height, confidence: 90 })
      x += width + charWidth
    }
  }
  return { text: words.map((word) => word.text).join(" "), confidence: 90, words }
}

const VERBS = [
  ["beginnen", "begann", "begonnen", "начинать"],
  ["bleiben", "blieb", "geblieben", "оставаться"],
  ["essen", "aß", "gegessen", "есть"],
  ["fahren", "fuhr", "gefahren", "ехать на транспорте"],
  ["fallen", "fiel", "gefallen", "падать"],
  ["geben", "gab", "gegeben", "давать"],
  ["helfen", "half", "geholfen", "помогать"],
]
const COLUMNS = [60, 320, 580, 880]
const table = (rows, options) => rows.map((row) => line(row.map((cell, index) => [COLUMNS[index], cell]), options))

check("a four-column table keeps the forms together and the translation apart", () => {
  const pairs = pairsFromLines(table(VERBS))
  equal(detectColumns(table(VERBS)), COLUMNS, "columns")
  equal(
    pairs,
    VERBS.map(([a, b, c, russian]) => ({ term: `${a} ${b} ${c}`, definition: russian })),
    "pairs",
  )
})

check("a title across the columns is not a card", () => {
  const lines = [
    line([[395, "Starke Verben"]]),
    line([[343, "Infinitiv * Präteritum * Partizip II * Russisch"]]),
    ...table(VERBS),
  ]
  equal(pairsFromLines(lines).length, VERBS.length, "rows")
})

check("a column heading is dropped, a row further down is kept", () => {
  const lines = table([["Infinitiv", "Präteritum", "Partizip II", "Russisch"], ...VERBS])
  const pairs = dropHeadings(harmonizeScripts(pairsFromLines(lines)))
  equal(pairs.length, VERBS.length, "rows")
  equal(pairs[0], { term: "beginnen begann begonnen", definition: "начинать" }, "first row")
})

check("a page photographed at an angle still has columns", () => {
  const lines = VERBS.map((row, index) =>
    line(
      row.map((cell, column) => [COLUMNS[column], cell]),
      { drift: index },
    ),
  )
  equal(pairsFromLines(lines).length, VERBS.length, "rows")
  equal(pairsFromLines(lines)[0].definition, "начинать", "translation")
})

check("the space after an article is not a column", () => {
  const list = [
    ["die Wohnung", "квартира"],
    ["der Schlüssel", "ключ"],
    ["das Fenster", "окно"],
    ["die Treppe", "лестница"],
    ["der Kühlschrank", "холодильник"],
    ["die Waschmaschine", "стиральная машина"],
  ]
  const lines = list.map(([term, definition]) => line([[60, term], [420, definition]]))
  equal(
    pairsFromLines(lines),
    list.map(([term, definition]) => ({ term, definition })),
    "pairs",
  )
})

check("a translation wrapped onto the next line joins the row above", () => {
  const lines = [
    ...table(VERBS),
    line([[880, "на поезде"]]),
  ]
  const pairs = pairsFromLines(lines)
  equal(pairs.length, VERBS.length, "rows")
  equal(pairs[pairs.length - 1].definition, "помогать на поезде", "the wrapped translation")
})

check("a column that only numbers the rows is not part of the card", () => {
  const lines = VERBS.map((row, index) =>
    line([[16, `${index + 1}.`], ...row.map((cell, column) => [COLUMNS[column], cell])]),
  )
  equal(pairsFromLines(lines)[0], { term: "beginnen begann begonnen", definition: "начинать" }, "first row")
})

check("without columns the switch of alphabet splits the line", () => {
  const lines = VERBS.map((row) => ({ text: row.join(" "), confidence: 90, words: [] }))
  equal(pairsFromLines(lines)[0], { term: "beginnen begann begonnen", definition: "начинать" }, "first row")
})

check("look-alike letters are pulled back to the column's own alphabet", () => {
  const pairs = harmonizeScripts([
    ...VERBS.map(([a, b, c, russian]) => ({ term: `${a} ${b} ${c}`, definition: russian })),
    { term: "waschen wusch gewaschen", definition: "MbITb" },
    { term: "sehen sah gesehen", definition: "OKHO" },
  ])
  equal(pairs[pairs.length - 2].definition, "мыть", "мыть read as Latin")
  equal(pairs[pairs.length - 1].definition, "окно", "окно read as Latin")
})

check("a German word is left alone in a German column", () => {
  const pairs = harmonizeScripts(
    VERBS.map(([a, b, c, russian]) => ({ term: `${a} ${b} ${c}`, definition: russian })),
  )
  equal(pairs[2].term, "essen aß gegessen", "term")
})

console.log(`\n${failures ? failures + " checks failed" : "all OCR parsing checks passed"}`)
process.exit(failures ? 1 : 0)
