"use client"

import * as React from "react"
import Link from "next/link"
import { Languages, RotateCcw, Trophy } from "lucide-react"
import { toast } from "sonner"
import { useStore } from "@/lib/store"
import { shuffle } from "@/lib/text"
import { VERBS } from "@/lib/verbs/data"
import { conjugateOne, personsFor } from "@/lib/verbs/conjugate"
import { PERSON_LABELS, TENSES, TENSE_HINTS, TENSE_LABELS, type Person, type Tense, type VerbEntry } from "@/lib/verbs/types"
import { LEVEL_INFO, type Level } from "@/lib/catalog/types"
import { Confetti } from "@/components/confetti"
import { VerbQuestion } from "@/components/verb-question"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type Question = { verb: VerbEntry; tense: Tense; person: Person; answer: string }
type Miss = Question & { given: string }

const ROUND = 15
const LEVELS: Level[] = ["A1", "A2", "B1"]
const DEFAULT_TENSES: Tense[] = ["praesens", "perfekt"]

export default function VerbsPage() {
  const { state, ready, recordVerbAnswer } = useStore()

  const [levels, setLevels] = React.useState<Level[]>(["A1", "A2"])
  const [tenses, setTenses] = React.useState<Tense[]>(DEFAULT_TENSES)
  const [queue, setQueue] = React.useState<Question[] | null>(null)
  const [index, setIndex] = React.useState(0)
  const [stats, setStats] = React.useState({ correct: 0, wrong: 0 })
  const [missed, setMissed] = React.useState<Miss[]>([])
  const [done, setDone] = React.useState(false)

  const pool = React.useMemo(() => VERBS.filter((verb) => levels.includes(verb.level)), [levels])

  /** Every slot the current settings allow. */
  const candidates = React.useMemo(() => {
    const out: Question[] = []
    for (const verb of pool) {
      for (const tense of tenses) {
        for (const person of personsFor(tense)) {
          const answer = conjugateOne(verb, tense, person)
          if (answer) out.push({ verb, tense, person, answer })
        }
      }
    }
    return out
  }, [pool, tenses])

  const current = queue?.[index]

  if (!ready) return <Skeleton className="mx-auto mt-10 h-96 max-w-2xl rounded-xl" />

  /** Weakest first: never answered, then answered wrong, then the rest. */
  function buildRound(from: Question[]) {
    const weighted = from.map((question) => {
      const card = state.verbProgress[`${question.verb.infinitive}|${question.tense}`]
      const base = card ? card.box * 10 - card.incorrect * 4 : -5
      return { question, weight: base + Math.random() * 6 }
    })
    weighted.sort((a, b) => a.weight - b.weight)
    // Take from the weakest half, then shuffle so the order is not predictable.
    return shuffle(weighted.slice(0, Math.max(ROUND, Math.ceil(weighted.length / 2))).map((item) => item.question)).slice(0, ROUND)
  }

  function start(from?: Question[]) {
    const source = from ?? candidates
    if (!source.length) {
      toast.error("Выберите хотя бы одно время")
      return
    }
    setQueue(from ? shuffle(from) : buildRound(source))
    setIndex(0)
    setStats({ correct: 0, wrong: 0 })
    setMissed([])
    setDone(false)
  }

  function next() {
    setIndex((prev) => {
      if (!queue || prev + 1 >= queue.length) {
        setDone(true)
        return prev
      }
      return prev + 1
    })
  }

  /* ---------------- setup and results ---------------- */
  if (!queue || done) {
    const finished = done && queue
    const total = stats.correct + stats.wrong
    const percent = total ? Math.round((stats.correct / total) * 100) : 0

    return (
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        {finished && <Confetti active={percent >= 80} />}
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <Languages className="size-6" />
          </span>
          <div>
            <h1 className="display-type text-2xl font-extrabold tracking-tight">Спряжение глаголов</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {VERBS.length} глаголов A1–B1, шесть времён и наклонений. Форму нужно написать, а не выбрать.
            </p>
          </div>
        </div>

        {finished && (
          <div className="mt-6 rounded-xl border-2 bg-card p-6 text-center">
            <Trophy className={cn("mx-auto size-10", percent >= 80 ? "text-accent" : "text-muted-foreground")} />
            <p className="display-type mt-3 text-4xl font-extrabold">{percent}%</p>
            <p className="mt-1 text-sm font-bold text-muted-foreground">
              Верно {stats.correct} из {total}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button className="rounded-md font-bold" onClick={() => start()}>
                <RotateCcw className="size-4" />
                Ещё подход
              </Button>
              {missed.length > 0 && (
                <Button variant="outline" className="rounded-md font-bold" onClick={() => start(missed)}>
                  Только ошибки ({missed.length})
                </Button>
              )}
            </div>
          </div>
        )}

        {finished && missed.length > 0 && (
          <div className="mt-6 space-y-2">
            <p className="text-sm font-bold">Разбор ошибок</p>
            {missed.map((miss, position) => (
              <div key={`${miss.verb.infinitive}-${miss.tense}-${miss.person}-${position}`} className="rounded-md border bg-card p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {miss.verb.infinitive} · {TENSE_LABELS[miss.tense]} · {PERSON_LABELS[miss.person]}
                </p>
                <p className="mt-1.5 font-bold text-chart-2">{miss.answer}</p>
                {miss.given && <p className="text-sm text-muted-foreground line-through">{miss.given}</p>}
              </div>
            ))}
          </div>
        )}

        <section className="mt-8 space-y-5 rounded-xl border bg-card p-5">
          <div>
            <p className="display-type mb-2 text-sm font-extrabold">Уровень</p>
            <div className="flex flex-wrap gap-2">
              {LEVELS.map((level) => {
                const on = levels.includes(level)
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setLevels((prev) => (on ? prev.filter((item) => item !== level) : [...prev, level]))}
                    className={cn(
                      "rounded-md border-2 px-4 py-2 text-sm font-bold transition-colors",
                      on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-secondary",
                    )}
                  >
                    {level}
                    <span className="ml-1.5 text-xs opacity-70">{LEVEL_INFO[level].caption.split(" ")[0]}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <p className="display-type mb-2 text-sm font-extrabold">Времена и наклонения</p>
            <div className="space-y-2">
              {TENSES.map((tense) => (
                <label key={tense} className="flex cursor-pointer items-center gap-3 text-sm">
                  <Checkbox
                    checked={tenses.includes(tense)}
                    onCheckedChange={(checked) =>
                      setTenses((prev) => (checked ? [...prev, tense] : prev.filter((item) => item !== tense)))
                    }
                  />
                  <span className="font-bold">{TENSE_LABELS[tense]}</span>
                  <span className="text-muted-foreground">{TENSE_HINTS[tense]}</span>
                </label>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Доступно вопросов: {candidates.length}. Умляуты проверяются строго — именно их тут и тренируют.
          </p>

          <Button size="lg" className="h-12 w-full rounded-md font-bold" disabled={!candidates.length} onClick={() => start()}>
            {finished ? "Новый подход" : `Начать · ${Math.min(ROUND, candidates.length)} вопросов`}
          </Button>
        </section>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Возвратные глаголы в тренажёр не входят: местоимение меняется по лицам и верный ответ стал бы неоднозначным.
        </p>
      </div>
    )
  }

  /* ---------------- the drill ---------------- */
  if (!current) return <Skeleton className="mx-auto mt-10 h-96 max-w-2xl rounded-xl" />

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between text-sm font-bold">
        <span className="text-muted-foreground">{TENSE_LABELS[current.tense]}</span>
        <span className="tabular-nums">
          {index + 1} / {queue.length}
        </span>
      </div>
      <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${((index + 1) / queue.length) * 100}%` }} />
      </div>

      <VerbQuestion
        verb={current.verb}
        tense={current.tense}
        person={current.person}
        onAnswered={(result, given) => {
          const correct = result === "correct"
          recordVerbAnswer(`${current.verb.infinitive}|${current.tense}`, correct)
          setStats((prev) => ({ correct: prev.correct + (correct ? 1 : 0), wrong: prev.wrong + (correct ? 0 : 1) }))
          if (!correct) setMissed((prev) => [...prev, { ...current, given }])
        }}
        onNext={next}
      />

      <div className="mt-6 flex justify-center gap-6 text-sm font-bold text-muted-foreground">
        <span className="text-chart-2">Верно: {stats.correct}</span>
        <span className="text-destructive">Ошибок: {stats.wrong}</span>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        <Link href="/drills" className="font-bold text-primary underline">
          Все тренировки
        </Link>
      </p>
    </div>
  )
}
