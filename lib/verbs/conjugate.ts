import { IMPERATIVE_PERSONS, PERSONS, type Forms, type Person, type Tense, type VerbEntry } from "./types.ts"

/**
 * Forms are derived by rule wherever German is regular, and taken from the
 * verb's own data wherever it is not. Nothing is guessed: a verb whose
 * endings are contested carries an explicit table instead.
 */

/** Strips the separable prefix: rules work on the base verb. */
function base(verb: VerbEntry) {
  return verb.separable ? verb.infinitive.slice(verb.separable.length) : verb.infinitive
}

function stemOf(infinitive: string) {
  if (/e[lr]n$/.test(infinitive)) return infinitive.slice(0, -1) // sammeln -> sammel
  if (infinitive.endsWith("en")) return infinitive.slice(0, -2)
  if (infinitive.endsWith("n")) return infinitive.slice(0, -1) // tun -> tu
  return infinitive
}

/**
 * "arbeiten", "atmen", "rechnen" need a linking -e- before -st and -t;
 * "wohnen", "lernen", "filmen" do not. The split is what stands before the
 * final m or n: a vowel, l, r, m, n, or an h that follows a vowel, all block it.
 */
function needsLinkingE(stem: string) {
  if (/[dt]$/.test(stem)) return true
  const match = /(.)([mn])$/.exec(stem)
  if (!match) return false
  const before = match[1]
  if (/[aeiouäöülrmn]/.test(before)) return false
  if (before === "h") return /[aeiouäöü]h[mn]$/.test(stem) ? false : true
  return true
}

/** After s, ß, x, z the du-ending loses its s: heißt, tanzt. */
function sibilantStem(stem: string) {
  return /(s|ß|x|z)$/.test(stem)
}

function presentByRule(infinitive: string): Record<Person, string> {
  const stem = stemOf(infinitive)
  const short = /e[lr]n$/.test(infinitive) || /[^e]n$/.test(infinitive.slice(-2)) // sammeln, tun -> wir ...n
  const plural = short ? "n" : "en"
  const linking = needsLinkingE(stem)

  // "ich sammle", not "ich sammele"
  const ich = /eln$/.test(infinitive) ? `${stem.replace(/el$/, "l")}e` : `${stem}e`
  const du = sibilantStem(stem) ? `${stem}t` : linking ? `${stem}est` : `${stem}st`
  const er = linking ? `${stem}et` : `${stem}t`

  return {
    ich,
    du,
    er,
    wir: `${stem}${plural}`,
    ihr: er,
    sie: `${stem}${plural}`,
  }
}

function praeteritumByRule(verb: VerbEntry): Record<Person, string> {
  const infinitive = base(verb)
  if (!verb.praeteritum) {
    // Weak: stem + -te-
    const stem = stemOf(infinitive)
    const root = needsLinkingE(stem) ? `${stem}ete` : `${stem}te`
    return { ich: root, du: `${root}st`, er: root, wir: `${root}n`, ihr: `${root}t`, sie: `${root}n` }
  }

  const root = verb.praeteritum
  // Stems that already end in -e (hatte, konnte, wurde) take the short endings.
  if (root.endsWith("e")) {
    return { ich: root, du: `${root}st`, er: root, wir: `${root}n`, ihr: `${root}t`, sie: `${root}n` }
  }
  const linking = /[dt]$/.test(root)
  const sibilant = /(s|ß|x|z)$/.test(root)
  return {
    ich: root,
    du: linking || sibilant ? `${root}est` : `${root}st`,
    er: root,
    wir: `${root}en`,
    ihr: linking ? `${root}et` : `${root}t`,
    sie: `${root}en`,
  }
}

const HABEN_PRESENT: Record<Person, string> = {
  ich: "habe", du: "hast", er: "hat", wir: "haben", ihr: "habt", sie: "haben",
}
const SEIN_PRESENT: Record<Person, string> = {
  ich: "bin", du: "bist", er: "ist", wir: "sind", ihr: "seid", sie: "sind",
}
const WERDEN_PRESENT: Record<Person, string> = {
  ich: "werde", du: "wirst", er: "wird", wir: "werden", ihr: "werdet", sie: "werden",
}
const WUERDE: Record<Person, string> = {
  ich: "würde", du: "würdest", er: "würde", wir: "würden", ihr: "würdet", sie: "würden",
}

/** A finite form in a main clause sends the separable prefix to the end. */
function withPrefix(form: string, verb: VerbEntry) {
  return verb.separable ? `${form} ${verb.separable}` : form
}

function presentForms(verb: VerbEntry): Record<Person, string> {
  const rule = presentByRule(base(verb))
  const merged = { ...rule, ...(verb.present ?? {}) } as Record<Person, string>
  return Object.fromEntries(PERSONS.map((person) => [person, withPrefix(merged[person], verb)])) as Record<Person, string>
}

function praeteritumForms(verb: VerbEntry): Record<Person, string> {
  const rule = praeteritumByRule(verb)
  return Object.fromEntries(PERSONS.map((person) => [person, withPrefix(rule[person], verb)])) as Record<Person, string>
}

function perfektForms(verb: VerbEntry): Record<Person, string> {
  const aux = verb.aux === "sein" ? SEIN_PRESENT : HABEN_PRESENT
  return Object.fromEntries(PERSONS.map((person) => [person, `${aux[person]} ${verb.partizip}`])) as Record<Person, string>
}

function futurForms(verb: VerbEntry): Record<Person, string> {
  return Object.fromEntries(
    PERSONS.map((person) => [person, `${WERDEN_PRESENT[person]} ${verb.infinitive}`]),
  ) as Record<Person, string>
}

function konjunktiv2Forms(verb: VerbEntry): Record<Person, string> {
  const own = verb.konjunktiv2
  if (!own) {
    // The ordinary way to say it: würde + Infinitiv.
    return Object.fromEntries(
      PERSONS.map((person) => [person, `${WUERDE[person]} ${verb.infinitive}`]),
    ) as Record<Person, string>
  }
  if (typeof own !== "string") {
    return Object.fromEntries(PERSONS.map((person) => [person, withPrefix(own[person] ?? "", verb)])) as Record<Person, string>
  }
  // Stems ending in -te/-de keep the e: hättest, könntest, würdest.
  const root = own
  const forms: Record<Person, string> = {
    ich: root,
    du: `${root}st`,
    er: root,
    wir: `${root}n`,
    ihr: `${root}t`,
    sie: `${root}n`,
  }
  return Object.fromEntries(PERSONS.map((person) => [person, withPrefix(forms[person], verb)])) as Record<Person, string>
}

function imperativForms(verb: VerbEntry): Forms {
  if (verb.noImperative) return {}
  const infinitive = base(verb)
  const stem = stemOf(infinitive)
  const du =
    verb.imperativDu ??
    (/eln$/.test(infinitive)
      ? stem.replace(/el$/, "le")
      : needsLinkingE(stem) || /ig$/.test(stem)
        ? `${stem}e`
        : stem)
  const present = presentByRule(infinitive)
  // A separable verb splits here too: "Stehen Sie auf!", not "Aufstehen Sie!".
  const sie = verb.imperativSie ?? (verb.separable ? `${infinitive} Sie ${verb.separable}` : `${verb.infinitive} Sie`)
  return {
    du: withPrefix(du, verb),
    ihr: withPrefix(verb.present?.ihr ?? present.ihr, verb),
    sie,
  }
}

export function conjugate(verb: VerbEntry, tense: Tense): Forms {
  switch (tense) {
    case "praesens":
      return presentForms(verb)
    case "praeteritum":
      return praeteritumForms(verb)
    case "perfekt":
      return perfektForms(verb)
    case "futur1":
      return futurForms(verb)
    case "konjunktiv2":
      return konjunktiv2Forms(verb)
    case "imperativ":
      return imperativForms(verb)
  }
}

export function conjugateOne(verb: VerbEntry, tense: Tense, person: Person): string | null {
  if (tense === "imperativ" && !IMPERATIVE_PERSONS.includes(person)) return null
  return conjugate(verb, tense)[person] ?? null
}

/** Persons a tense can be asked in. */
export function personsFor(tense: Tense): Person[] {
  return tense === "imperativ" ? IMPERATIVE_PERSONS : [...PERSONS]
}

/**
 * Every spelling that is correct for this slot. The du-imperative of a weak
 * verb is the main case: "lern!" and "lerne!" are both right, and marking one
 * of them wrong would teach nothing.
 */
export function acceptableForms(verb: VerbEntry, tense: Tense, person: Person): string[] {
  const primary = conjugateOne(verb, tense, person)
  if (!primary) return []
  const forms = new Set<string>([primary])
  if (tense === "imperativ" && person === "du" && !verb.imperativDu) {
    const stem = stemOf(base(verb))
    if (!needsLinkingE(stem) && !/e[lr]n$/.test(base(verb))) {
      forms.add(withPrefix(`${stem}e`, verb))
    }
  }
  return Array.from(forms)
}
