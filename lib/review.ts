import type { AppState, StudySet, Term } from "./types"
import { cardOf, emptyProgress } from "./srs"
import { VERBS } from "./verbs/data"
import { personsFor } from "./verbs/conjugate"
import { TENSES, type Person, type Tense, type VerbEntry } from "./verbs/types"

/**
 * Leitner intervals in days. A card answered correctly moves up a box and is
 * not shown again until its interval has passed — the spacing effect is what
 * moves words into long-term memory.
 */
export const BOX_INTERVAL_DAYS = [0, 1, 2, 4, 8, 21]

/**
 * Minutes to wait before a card comes back. A card you just got wrong drops to
 * box 0 and returns after a short relearning gap rather than instantly, so the
 * review queue can actually reach zero.
 */
const BOX_INTERVAL_MINUTES = [10, 1440, 2880, 5760, 11520, 30240]

const DAY = 86_400_000
const MINUTE = 60_000

export type DueCard = { set: StudySet; term: Term; box: number; dueAt: number }

export function dueAtFor(lastSeen: number, box: number) {
  if (!lastSeen) return 0
  const minutes = BOX_INTERVAL_MINUTES[Math.min(Math.max(0, box), BOX_INTERVAL_MINUTES.length - 1)]
  return lastSeen + minutes * MINUTE
}

/** Cards that have been studied before and whose interval has elapsed. */
export function collectDue(state: AppState, now = Date.now()): DueCard[] {
  const out: DueCard[] = []
  for (const set of state.sets) {
    const progress = state.progress[set.id] ?? emptyProgress()
    for (const term of set.terms) {
      const card = cardOf(progress, term.id)
      if (!card.lastSeen) continue
      const dueAt = dueAtFor(card.lastSeen, card.box)
      if (dueAt <= now) out.push({ set, term, box: card.box, dueAt })
    }
  }
  // The most overdue first: those are closest to being forgotten.
  return out.sort((a, b) => a.dueAt - b.dueAt)
}

/** Cards never answered yet, oldest set first. */
export function collectFresh(state: AppState): DueCard[] {
  const out: DueCard[] = []
  for (const set of state.sets) {
    const progress = state.progress[set.id] ?? emptyProgress()
    for (const term of set.terms) {
      const card = cardOf(progress, term.id)
      if (card.lastSeen) continue
      out.push({ set, term, box: 0, dueAt: 0 })
    }
  }
  return out
}

/* ---------- conjugation practice on the same schedule ---------- */

export type DueVerb = { key: string; verb: VerbEntry; tense: Tense; box: number; dueAt: number }

const VERB_BY_INFINITIVE = new Map(VERBS.map((verb) => [verb.infinitive, verb]))

function parseVerbKey(key: string) {
  const [infinitive, tense] = key.split("|")
  const verb = VERB_BY_INFINITIVE.get(infinitive)
  if (!verb || !TENSES.includes(tense as Tense)) return null
  return { verb, tense: tense as Tense }
}

/**
 * Conjugation slots whose interval has elapsed.
 *
 * Only slots already practised in the trainer take part: a verb is met there
 * first, and review keeps it from fading. Otherwise 800-odd untouched slots
 * would bury the vocabulary queue on day one.
 */
export function collectDueVerbs(state: AppState, now = Date.now()): DueVerb[] {
  const out: DueVerb[] = []
  for (const [key, card] of Object.entries(state.verbProgress ?? {})) {
    if (!card?.lastSeen) continue
    const parsed = parseVerbKey(key)
    if (!parsed) continue
    const dueAt = dueAtFor(card.lastSeen, card.box)
    if (dueAt <= now) out.push({ key, verb: parsed.verb, tense: parsed.tense, box: card.box, dueAt })
  }
  return out.sort((a, b) => a.dueAt - b.dueAt)
}

/** Progress is kept per verb and tense, so the person is drawn fresh each time. */
export function personForSlot(tense: Tense): Person {
  const options = personsFor(tense)
  return options[Math.floor(Math.random() * options.length)]
}

/** When the next thing becomes due, or null when nothing is scheduled. */
export function nextDueAt(state: AppState, now = Date.now()): number | null {
  let soonest: number | null = null
  const consider = (lastSeen: number, box: number) => {
    if (!lastSeen) return
    const dueAt = dueAtFor(lastSeen, box)
    if (dueAt > now && (soonest === null || dueAt < soonest)) soonest = dueAt
  }
  for (const set of state.sets) {
    const progress = state.progress[set.id] ?? emptyProgress()
    for (const term of set.terms) {
      const card = cardOf(progress, term.id)
      consider(card.lastSeen, card.box)
    }
  }
  for (const [key, card] of Object.entries(state.verbProgress ?? {})) {
    if (parseVerbKey(key)) consider(card?.lastSeen ?? 0, card?.box ?? 0)
  }
  return soonest
}

/** How conjugation practice is spread across the Leitner boxes. */
export function verbMastery(state: AppState) {
  let mastered = 0
  let familiar = 0
  let learning = 0
  for (const [key, card] of Object.entries(state.verbProgress ?? {})) {
    if (!parseVerbKey(key) || !card?.lastSeen) continue
    if (card.status === "mastered") mastered += 1
    else if (card.status === "familiar") familiar += 1
    else learning += 1
  }
  const total = mastered + familiar + learning
  return { mastered, familiar, learning, total, percent: total ? Math.round(((mastered + familiar * 0.6) / total) * 100) : 0 }
}

export function formatDueIn(timestamp: number, now = Date.now()) {
  const diff = Math.max(0, timestamp - now)
  const minutes = Math.round(diff / MINUTE)
  if (minutes < 60) return `${Math.max(1, minutes)} мин`
  const hours = Math.round(diff / 3_600_000)
  if (hours < 24) return `${hours} ч`
  const days = Math.round(diff / DAY)
  return `${days} дн.`
}

/* ---------- German article drill ---------- */

export type ArticleCard = { setId: string; term: Term; article: "der" | "die" | "das"; noun: string }

const ARTICLE_RULE = /^(der|die|das)\s+(.+)$/i

/** Every noun in the library that carries a definite article. */
export function collectArticleCards(state: AppState): ArticleCard[] {
  const out: ArticleCard[] = []
  const seen = new Set<string>()
  for (const set of state.sets) {
    for (const term of set.terms) {
      const match = ARTICLE_RULE.exec(term.term.trim())
      if (!match) continue
      const article = match[1].toLowerCase() as "der" | "die" | "das"
      const noun = match[2].trim()
      const key = `${article}|${noun.toLowerCase()}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ setId: set.id, term, article, noun })
    }
  }
  return out
}

/** Follows the theme: each token has a light and a dark value. */
export const ARTICLE_COLORS: Record<"der" | "die" | "das", string> = {
  der: "var(--chart-4)",
  die: "var(--destructive)",
  das: "var(--chart-2)",
}
