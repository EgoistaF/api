import type { Level } from "../catalog/types.ts"

export const PERSONS = ["ich", "du", "er", "wir", "ihr", "sie"] as const
export type Person = (typeof PERSONS)[number]

/** Labels as a learner sees them. */
export const PERSON_LABELS: Record<Person, string> = {
  ich: "ich",
  du: "du",
  er: "er/sie/es",
  wir: "wir",
  ihr: "ihr",
  sie: "sie/Sie",
}

export const TENSES = ["praesens", "praeteritum", "perfekt", "futur1", "konjunktiv2", "imperativ"] as const
export type Tense = (typeof TENSES)[number]

export const TENSE_LABELS: Record<Tense, string> = {
  praesens: "Präsens",
  praeteritum: "Präteritum",
  perfekt: "Perfekt",
  futur1: "Futur I",
  konjunktiv2: "Konjunktiv II",
  imperativ: "Imperativ",
}

export const TENSE_HINTS: Record<Tense, string> = {
  praesens: "настоящее время",
  praeteritum: "простое прошедшее",
  perfekt: "разговорное прошедшее",
  futur1: "будущее время",
  konjunktiv2: "сослагательное наклонение",
  imperativ: "повелительное наклонение",
}

/** The imperative exists for these persons only. */
export const IMPERATIVE_PERSONS: Person[] = ["du", "ihr", "sie"]

export type Forms = Partial<Record<Person, string>>

export type VerbEntry = {
  /** Full infinitive, separable prefix included: "aufstehen". */
  infinitive: string
  translation: string
  level: Level
  /** Which auxiliary the Perfekt takes. */
  aux: "haben" | "sein"
  /** Separable prefix, which moves to the end of a main clause. */
  separable?: string
  /** Präsens forms the regular endings do not produce: a stem change, or a verb that is simply irregular. */
  present?: Forms
  /** Präteritum ich-form. Absent means the verb is weak and the form is derived. */
  praeteritum?: string
  /** Partizip II, prefix included. */
  partizip: string
  /**
   * Konjunktiv II. Absent means the verb forms it with würde + Infinitiv,
   * which is what the language actually does outside a small set.
   * A full table is given where endings are contested.
   */
  konjunktiv2?: string | Forms
  /** du-imperative when it is not the plain stem: "lies", "nimm", "sei". */
  imperativDu?: string
  /** Sie-imperative when it is not "Infinitiv Sie": "seien Sie". */
  imperativSie?: string
  /** Modal verbs and the like have no imperative at all. */
  noImperative?: boolean
}
