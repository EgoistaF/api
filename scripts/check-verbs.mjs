/**
 * Checks the conjugation engine.
 *
 * Two layers: structural invariants that hold for every German verb, run over
 * the whole dataset, and hand-written tables for verbs whose forms are beyond
 * doubt. The invariants catch data-entry slips; the tables catch wrong rules.
 */
import { conjugate, conjugateOne, acceptableForms, personsFor } from "../lib/verbs/conjugate.ts"
import { gradeVerbAnswer } from "../lib/verbs/grade.ts"
import { VERBS } from "../lib/verbs/data.ts"
import { PERSONS, TENSES } from "../lib/verbs/types.ts"

const failures = []
let checks = 0
const fail = (message) => failures.push(message)
const byInfinitive = new Map(VERBS.map((verb) => [verb.infinitive, verb]))
const verb = (infinitive) => {
  const found = byInfinitive.get(infinitive)
  if (!found) throw new Error(`no such verb in the dataset: ${infinitive}`)
  return found
}

/* ---------------- structural invariants ---------------- */

const seen = new Set()
for (const entry of VERBS) {
  if (seen.has(entry.infinitive)) fail(`duplicate verb: ${entry.infinitive}`)
  seen.add(entry.infinitive)
}

const HABEN = { ich: "habe", du: "hast", er: "hat", wir: "haben", ihr: "habt", sie: "haben" }
const SEIN = { ich: "bin", du: "bist", er: "ist", wir: "sind", ihr: "seid", sie: "sind" }
const WERDEN = { ich: "werde", du: "wirst", er: "wird", wir: "werden", ihr: "werdet", sie: "werden" }

for (const entry of VERBS) {
  const name = entry.infinitive

  for (const tense of TENSES) {
    const forms = conjugate(entry, tense)
    if (tense === "imperativ" && entry.noImperative) {
      checks++
      if (Object.keys(forms).length) fail(`${name}: has an imperative but should not`)
      continue
    }
    for (const person of personsFor(tense)) {
      checks++
      const form = forms[person]
      if (!form) { fail(`${name} ${tense} ${person}: empty`); continue }
      if (form !== form.trim() || /\s{2,}/.test(form)) fail(`${name} ${tense} ${person}: bad spacing "${form}"`)
      if (/undefined|null|NaN/.test(form)) fail(`${name} ${tense} ${person}: "${form}"`)
    }
  }

  const present = conjugate(entry, "praesens")
  const praeteritum = conjugate(entry, "praeteritum")
  const perfekt = conjugate(entry, "perfekt")
  const futur = conjugate(entry, "futur1")

  // Facts true of every German verb.
  checks += 2
  if (present.wir !== present.sie) fail(`${name}: wir and sie differ in Präsens`)
  if (praeteritum.ich !== praeteritum.er) fail(`${name}: ich and er differ in Präteritum`)

  // Compound tenses are mechanical; they must match exactly.
  const aux = entry.aux === "sein" ? SEIN : HABEN
  for (const person of PERSONS) {
    checks += 2
    if (perfekt[person] !== `${aux[person]} ${entry.partizip}`) {
      fail(`${name} Perfekt ${person}: "${perfekt[person]}"`)
    }
    if (futur[person] !== `${WERDEN[person]} ${entry.infinitive}`) {
      fail(`${name} Futur ${person}: "${futur[person]}"`)
    }
  }

  // A separable prefix sits at the end of a finite main-clause form.
  if (entry.separable) {
    checks += 3
    if (!entry.infinitive.startsWith(entry.separable)) fail(`${name}: infinitive does not start with "${entry.separable}"`)
    if (!present.ich.endsWith(` ${entry.separable}`)) fail(`${name}: Präsens ich keeps the prefix attached: "${present.ich}"`)
    if (!entry.partizip.startsWith(entry.separable)) fail(`${name}: Partizip misses the prefix: "${entry.partizip}"`)
  }

  // Partizip II ends in -t (weak and mixed) or -n (strong: gegangen, getan).
  checks++
  if (!/(t|n)$/.test(entry.partizip)) fail(`${name}: odd Partizip "${entry.partizip}"`)

  // Verbs with an inseparable prefix or -ieren take no ge-. "ge" and "er" are
  // left out of the list because they are also ordinary stem openings —
  // gehen, geben, gewinnen are not prefixed verbs.
  const stem = entry.separable ? entry.infinitive.slice(entry.separable.length) : entry.infinitive
  const inseparable = /^(be|emp|ent|miss|ver|zer)/.test(stem) || /ieren$/.test(stem)
  checks++
  if (inseparable && entry.partizip.slice(entry.separable?.length ?? 0).startsWith("ge")) {
    fail(`${name}: Partizip "${entry.partizip}" should have no ge-`)
  }

  // An override that changes nothing is a typo waiting to happen.
  if (entry.present) {
    checks++
    const plain = conjugate({ ...entry, present: undefined }, "praesens")
    const changed = Object.entries(entry.present).some(([person, form]) => plain[person] !== (entry.separable ? `${form} ${entry.separable}` : form))
    if (!changed) fail(`${name}: present override repeats what the rules already produce`)
  }

  // du and er coincide only after a sibilant stem.
  checks++
  if (present.du === present.er && !/(s|ß|x|z)t( |$)/.test(present.du)) {
    fail(`${name}: du and er are identical ("${present.du}") without a sibilant stem`)
  }

  if (typeof entry.konjunktiv2 === "string") {
    checks++
    if (!entry.konjunktiv2.endsWith("e")) fail(`${name}: Konjunktiv II stem "${entry.konjunktiv2}" should end in -e`)
  }

  if (!entry.noImperative) {
    const imperative = conjugate(entry, "imperativ")
    checks += 2
    if (!imperative.sie?.includes(" Sie")) fail(`${name}: Sie-imperative "${imperative.sie}"`)
    if (entry.separable && !imperative.sie?.endsWith(` ${entry.separable}`)) {
      fail(`${name}: Sie-imperative does not split: "${imperative.sie}"`)
    }
  }
}

/* ---------------- hand-written tables ---------------- */

const table = (infinitive, tense, expected) => {
  const forms = conjugate(verb(infinitive), tense)
  for (const [person, want] of Object.entries(expected)) {
    checks++
    if (forms[person] !== want) fail(`${infinitive} ${tense} ${person}: got "${forms[person]}", expected "${want}"`)
  }
}
const one = (infinitive, tense, person, want) => {
  checks++
  const got = conjugateOne(verb(infinitive), tense, person)
  if (got !== want) fail(`${infinitive} ${tense} ${person}: got "${got}", expected "${want}"`)
}

table("sein", "praesens", { ich: "bin", du: "bist", er: "ist", wir: "sind", ihr: "seid", sie: "sind" })
table("haben", "praesens", { ich: "habe", du: "hast", er: "hat", wir: "haben", ihr: "habt", sie: "haben" })
table("werden", "praesens", { ich: "werde", du: "wirst", er: "wird", wir: "werden", ihr: "werdet", sie: "werden" })
table("können", "praesens", { ich: "kann", du: "kannst", er: "kann", wir: "können", ihr: "könnt", sie: "können" })
table("wissen", "praesens", { ich: "weiß", du: "weißt", er: "weiß", wir: "wissen", ihr: "wisst", sie: "wissen" })
table("fahren", "praesens", { ich: "fahre", du: "fährst", er: "fährt", wir: "fahren", ihr: "fahrt", sie: "fahren" })
table("lesen", "praesens", { ich: "lese", du: "liest", er: "liest", wir: "lesen", ihr: "lest", sie: "lesen" })
table("nehmen", "praesens", { ich: "nehme", du: "nimmst", er: "nimmt", wir: "nehmen", ihr: "nehmt", sie: "nehmen" })
table("arbeiten", "praesens", { ich: "arbeite", du: "arbeitest", er: "arbeitet", wir: "arbeiten", ihr: "arbeitet", sie: "arbeiten" })
table("heißen", "praesens", { ich: "heiße", du: "heißt", er: "heißt", wir: "heißen", ihr: "heißt", sie: "heißen" })
table("sammeln", "praesens", { ich: "sammle", du: "sammelst", er: "sammelt", wir: "sammeln", ihr: "sammelt", sie: "sammeln" })
table("tun", "praesens", { ich: "tue", du: "tust", er: "tut", wir: "tun", ihr: "tut", sie: "tun" })
table("rechnen", "praesens", { ich: "rechne", du: "rechnest", er: "rechnet", wir: "rechnen", ihr: "rechnet", sie: "rechnen" })
table("wohnen", "praesens", { ich: "wohne", du: "wohnst", er: "wohnt", wir: "wohnen", ihr: "wohnt", sie: "wohnen" })
table("öffnen", "praesens", { ich: "öffne", du: "öffnest", er: "öffnet", wir: "öffnen", ihr: "öffnet", sie: "öffnen" })
table("atmen", "praesens", { ich: "atme", du: "atmest", er: "atmet", wir: "atmen", ihr: "atmet", sie: "atmen" })
table("lernen", "praesens", { ich: "lerne", du: "lernst", er: "lernt", wir: "lernen", ihr: "lernt", sie: "lernen" })
table("einladen", "praesens", { ich: "lade ein", du: "lädst ein", er: "lädt ein", wir: "laden ein", ihr: "ladet ein", sie: "laden ein" })
table("aufstehen", "praesens", { ich: "stehe auf", du: "stehst auf", er: "steht auf", wir: "stehen auf", ihr: "steht auf", sie: "stehen auf" })

table("sein", "praeteritum", { ich: "war", du: "warst", er: "war", wir: "waren", ihr: "wart", sie: "waren" })
table("haben", "praeteritum", { ich: "hatte", du: "hattest", er: "hatte", wir: "hatten", ihr: "hattet", sie: "hatten" })
table("gehen", "praeteritum", { ich: "ging", du: "gingst", er: "ging", wir: "gingen", ihr: "gingt", sie: "gingen" })
table("finden", "praeteritum", { ich: "fand", du: "fandest", er: "fand", wir: "fanden", ihr: "fandet", sie: "fanden" })
table("sitzen", "praeteritum", { ich: "saß", du: "saßest", er: "saß", wir: "saßen", ihr: "saßt", sie: "saßen" })
table("können", "praeteritum", { ich: "konnte", du: "konntest", er: "konnte", wir: "konnten", ihr: "konntet", sie: "konnten" })
table("machen", "praeteritum", { ich: "machte", du: "machtest", er: "machte", wir: "machten", ihr: "machtet", sie: "machten" })
table("arbeiten", "praeteritum", { ich: "arbeitete", du: "arbeitetest", er: "arbeitete", wir: "arbeiteten", ihr: "arbeitetet", sie: "arbeiteten" })
table("öffnen", "praeteritum", { ich: "öffnete", du: "öffnetest", er: "öffnete", wir: "öffneten", ihr: "öffnetet", sie: "öffneten" })
table("rechnen", "praeteritum", { ich: "rechnete", du: "rechnetest", er: "rechnete", wir: "rechneten", ihr: "rechnetet", sie: "rechneten" })
table("aufstehen", "praeteritum", { ich: "stand auf", du: "standest auf", er: "stand auf", wir: "standen auf", ihr: "standet auf", sie: "standen auf" })

one("fahren", "perfekt", "ich", "bin gefahren")
one("machen", "perfekt", "ich", "habe gemacht")
one("aufstehen", "perfekt", "ich", "bin aufgestanden")
one("studieren", "perfekt", "du", "hast studiert")
one("einladen", "perfekt", "er", "hat eingeladen")
one("vorstellen", "perfekt", "wir", "haben vorgestellt")

one("aufstehen", "futur1", "ich", "werde aufstehen")
one("sein", "futur1", "du", "wirst sein")

table("sein", "konjunktiv2", { ich: "wäre", du: "wärst", er: "wäre", wir: "wären", ihr: "wärt", sie: "wären" })
one("haben", "konjunktiv2", "du", "hättest")
one("können", "konjunktiv2", "ich", "könnte")
one("werden", "konjunktiv2", "ihr", "würdet")
one("machen", "konjunktiv2", "ich", "würde machen")
one("fahren", "konjunktiv2", "er", "würde fahren")

table("sein", "imperativ", { du: "sei", ihr: "seid", sie: "seien Sie" })
table("lesen", "imperativ", { du: "lies", ihr: "lest", sie: "lesen Sie" })
table("nehmen", "imperativ", { du: "nimm", ihr: "nehmt", sie: "nehmen Sie" })
table("arbeiten", "imperativ", { du: "arbeite", ihr: "arbeitet", sie: "arbeiten Sie" })
table("aufstehen", "imperativ", { du: "steh auf", ihr: "steht auf", sie: "stehen Sie auf" })
table("anrufen", "imperativ", { du: "ruf an", ihr: "ruft an", sie: "rufen Sie an" })
table("sammeln", "imperativ", { du: "sammle", ihr: "sammelt", sie: "sammeln Sie" })
table("öffnen", "imperativ", { du: "öffne", ihr: "öffnet", sie: "öffnen Sie" })

// Both spellings of a weak du-imperative are correct.
checks++
if (!acceptableForms(verb("lernen"), "imperativ", "du").includes("lerne")) fail("lernen: 'lerne' not accepted as an imperative")
checks++
if (!acceptableForms(verb("lernen"), "imperativ", "du").includes("lern")) fail("lernen: 'lern' not accepted as an imperative")

/* ---------------- grading ---------------- */

const grade = (infinitive, tense, person, input, want) => {
  checks++
  const got = gradeVerbAnswer(verb(infinitive), tense, person, input)
  if (got !== want) fail(`grade ${infinitive} ${tense} ${person} "${input}": got ${got}, expected ${want}`)
}

grade("fahren", "praesens", "du", "fährst", "correct")
grade("fahren", "praesens", "du", "  Fährst ", "correct")   // case and spacing are forgiven
grade("fahren", "praesens", "du", "fahrst", "umlaut")        // the very mistake being trained
grade("fahren", "praesens", "du", "fahre", "wrong")
grade("fahren", "praesens", "du", "", "wrong")
grade("heißen", "praesens", "du", "heisst", "umlaut")        // ß written as ss
grade("heißen", "praesens", "du", "heißt", "correct")
grade("können", "konjunktiv2", "ich", "konnte", "umlaut")
grade("können", "konjunktiv2", "ich", "könnte", "correct")
grade("lernen", "imperativ", "du", "lern", "correct")
grade("lernen", "imperativ", "du", "lerne", "correct")
grade("aufstehen", "praesens", "ich", "stehe auf", "correct")
grade("aufstehen", "praesens", "ich", "stehe   auf", "correct")
grade("aufstehen", "praesens", "ich", "aufstehe", "wrong")
grade("machen", "perfekt", "ich", "habe gemacht", "correct")
grade("machen", "perfekt", "ich", "bin gemacht", "wrong")

/* ---------------- report ---------------- */

const forms = VERBS.length * (PERSONS.length * 5 + 3)
console.log(`${checks} checks over ${VERBS.length} verbs (~${forms} generated forms)`)
if (failures.length) {
  console.error(`\n${failures.length} failed:`)
  failures.slice(0, 40).forEach((line) => console.error("  " + line))
  process.exit(1)
}
