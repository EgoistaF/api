import { acceptableForms } from "./conjugate.ts"
import type { Person, Tense, VerbEntry } from "./types.ts"

export type VerbVerdict = "correct" | "umlaut" | "wrong"

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

/** Compares ignoring exactly what the trainer exists to teach. */
function flatten(value: string) {
  return normalize(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
}

/**
 * Grading here is strict on purpose. In the vocabulary modes "fahrst" for
 * "fährst" is a typo worth forgiving; in a conjugation drill it is the very
 * mistake being practised, so it is marked wrong — but named, because
 * "the umlaut is missing" teaches more than a bare cross.
 */
export function gradeVerbAnswer(verb: VerbEntry, tense: Tense, person: Person, input: string): VerbVerdict {
  const accepted = acceptableForms(verb, tense, person)
  if (!accepted.length) return "wrong"
  const given = normalize(input)
  if (!given) return "wrong"
  if (accepted.some((form) => normalize(form) === given)) return "correct"
  if (accepted.some((form) => flatten(form) === flatten(given))) return "umlaut"
  return "wrong"
}
