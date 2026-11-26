/** Checks the part of the model-reading path that holds no API call. */
import { AI_MODELS, DEFAULT_MODEL, MAX_CARDS, isKnownModel, normalizeCards, pairsToText } from "../lib/ai.ts"

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
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    throw new Error(`${what}\n       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`)
  }
}

check("cards come back as trimmed pairs", () => {
  equal(
    normalizeCards({ cards: [{ term: " beginnen begann begonnen ", definition: "начинать " }] }),
    [{ term: "beginnen begann begonnen", definition: "начинать" }],
    "pairs",
  )
})

check("a bare array is read too", () => {
  equal(normalizeCards([{ term: "essen", definition: "есть" }]), [{ term: "essen", definition: "есть" }], "pairs")
})

check("junk in the answer is dropped, not thrown", () => {
  equal(
    normalizeCards({ cards: [null, 7, { term: "", definition: "" }, { term: "gehen" }, "nope"] }),
    [{ term: "gehen", definition: "" }],
    "pairs",
  )
  equal(normalizeCards(null), [], "nothing at all")
  equal(normalizeCards({ cards: "x" }), [], "wrong type")
})

check("a runaway answer is capped", () => {
  const many = Array.from({ length: MAX_CARDS + 50 }, (_, i) => ({ term: `w${i}`, definition: "x" }))
  equal(normalizeCards({ cards: many }).length, MAX_CARDS, "cards kept")
})

check("rows go to the model one per line", () => {
  equal(
    pairsToText([
      { term: "essen", definition: "есть" },
      { term: "", definition: "" },
      { term: "gehen", definition: "идти" },
    ]),
    "essen\tесть\ngehen\tидти",
    "text",
  )
})

check("only the offered models are accepted", () => {
  equal(AI_MODELS.some((model) => model.id === DEFAULT_MODEL), true, "default is on the list")
  equal(isKnownModel("claude-opus-5-5"), true, "opus")
  equal(isKnownModel("claude-haiku-5-5"), true, "haiku")
  equal(isKnownModel("gpt-4"), false, "a model we do not offer")
  equal(isKnownModel(undefined), false, "nothing")
})

console.log(`\n${failures ? failures + " checks failed" : "all AI helper checks passed"}`)
process.exit(failures ? 1 : 0)
