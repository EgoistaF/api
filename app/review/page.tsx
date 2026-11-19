"use client"

import * as React from "react"
import Link from "next/link"
import { CalendarCheck, Clock, Flame, Languages, Sparkles, Volume2 } from "lucide-react"
import { useStore } from "@/lib/store"
import {
  collectDue,
  collectDueVerbs,
  collectFresh,
  formatDueIn,
  nextDueAt,
  personForSlot,
  type DueCard,
  type DueVerb,
} from "@/lib/review"
import { streakFromDays } from "@/lib/srs"
import { gradeAnswer, pickRandom, plural, shuffle } from "@/lib/text"
import { speak } from "@/lib/speech"
import type { Person } from "@/lib/verbs/types"
import { ChoiceGrid, VerdictBanner, WrittenInput, type Verdict } from "@/components/answer-ui"
import { VerbQuestion } from "@/components/verb-question"
import { Confetti } from "@/components/confetti"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

const SESSION_CAP = 40

type Item = { kind: "card"; card: DueCard } | { kind: "verb"; slot: DueVerb; person: Person }

export default function ReviewPage() {
  const { state, ready, recordAnswer, recordVerbAnswer, completeRound } = useStore()
  const [queue, setQueue] = React.useState<Item[] | null>(null)
  const [index, setIndex] = React.useState(0)
  const [input, setInput] = React.useState("")
  const [picked, setPicked] = React.useState<string | null>(null)
  const [verdict, setVerdict] = React.useState<Verdict>("idle")
  const [stats, setStats] = React.useState({ correct: 0, wrong: 0 })
  const [done, setDone] = React.useState(false)

  const dueCards = React.useMemo(() => (ready ? collectDue(state) : []), [state, ready])
  const dueVerbs = React.useMemo(() => (ready ? collectDueVerbs(state) : []), [state, ready])
  const fresh = React.useMemo(() => (ready ? collectFresh(state) : []), [state, ready])
  const upcoming = React.useMemo(() => (ready ? nextDueAt(state) : null), [state, ready])
  const streak = streakFromDays(state.stats.studyDays)
  const dueTotal = dueCards.length + dueVerbs.length

  const current = queue?.[index]
  const currentCard = current?.kind === "card" ? current.card : null

  const options = React.useMemo(() => {
    if (!currentCard || currentCard.box >= 2) return []
    const distractors = pickRandom(currentCard.set.terms, 3, (item) => item.id === currentCard.term.id)
    return shuffle([
      { id: currentCard.term.id, label: currentCard.term.definition },
      ...distractors.map((item) => ({ id: item.id, label: item.definition })),
    ])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCard?.term.id])

  if (!ready) return <Skeleton className="mx-auto mt-10 h-80 max-w-2xl rounded-xl" />

  function start(items: Item[]) {
    setQueue(shuffle(items).slice(0, SESSION_CAP))
    setIndex(0)
    setInput("")
    setPicked(null)
    setVerdict("idle")
    setStats({ correct: 0, wrong: 0 })
    setDone(false)
  }

  const asItems = (cards: DueCard[], verbs: DueVerb[] = []): Item[] => [
    ...cards.map((card) => ({ kind: "card" as const, card })),
    ...verbs.map((slot) => ({ kind: "verb" as const, slot, person: personForSlot(slot.tense) })),
  ]

  function score(correct: boolean) {
    setStats((prev) => ({ correct: prev.correct + (correct ? 1 : 0), wrong: prev.wrong + (correct ? 0 : 1) }))
  }

  function next() {
    setInput("")
    setPicked(null)
    setVerdict("idle")
    setIndex((prev) => {
      if (!queue || prev + 1 >= queue.length) {
        setDone(true)
        return prev
      }
      return prev + 1
    })
  }

  /* ---------------- overview ---------------- */
  if (!queue || done) {
    const finished = done && queue
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        {finished && <Confetti active={stats.correct > stats.wrong} />}
        <div className="text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-md bg-primary/10 text-primary">
            <CalendarCheck className="size-6" />
          </span>
          <h1 className="display-type mt-4 text-2xl font-extrabold tracking-tight">Повторение по расписанию</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Карточка возвращается всё реже: через 1, 2, 4, 8 и 21 день. Так слова уходят в долговременную память.
          </p>
        </div>

        {finished && (
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="rounded-xl border bg-card p-5 text-center">
              <p className="text-3xl font-extrabold text-chart-2">{stats.correct}</p>
              <p className="mt-1 text-sm font-bold text-muted-foreground">Вспомнили</p>
            </div>
            <div className="rounded-xl border bg-card p-5 text-center">
              <p className="text-3xl font-extrabold text-destructive">{stats.wrong}</p>
              <p className="mt-1 text-sm font-bold text-muted-foreground">Забыли</p>
            </div>
          </div>
        )}

        <div className="mt-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-5">
            <div>
              <p className="text-sm font-bold text-muted-foreground">К повторению сейчас</p>
              <p className="text-3xl font-extrabold">{dueTotal}</p>
              {dueVerbs.length > 0 && (
                <p className="mt-0.5 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                  <Languages className="size-3.5" />
                  из них форм глаголов: {dueVerbs.length}
                </p>
              )}
            </div>
            <Button
              size="lg"
              className="rounded-md px-6 font-bold"
              disabled={!dueTotal}
              onClick={() => start(asItems(dueCards, dueVerbs))}
            >
              {dueTotal ? `Повторить ${Math.min(dueTotal, SESSION_CAP)}` : "Пока нечего"}
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-5">
            <div>
              <p className="text-sm font-bold text-muted-foreground">Новые карточки</p>
              <p className="text-3xl font-extrabold">{fresh.length}</p>
            </div>
            <Button
              size="lg"
              variant="outline"
              className="rounded-md px-6 font-bold"
              disabled={!fresh.length}
              onClick={() => start(asItems(fresh.slice(0, 20)))}
            >
              Выучить 20 новых
            </Button>
          </div>

          {!dueTotal && upcoming && (
            <p className="flex items-center justify-center gap-2 rounded-md bg-secondary px-4 py-3 text-sm font-bold">
              <Clock className="size-4" />
              Следующее повторение через {formatDueIn(upcoming)}
            </p>
          )}

          {streak > 0 && (
            <p className="flex items-center justify-center gap-2 text-sm font-bold text-muted-foreground">
              <Flame className="size-4 text-accent-foreground dark:text-accent" />
              Серия: {streak} {plural(streak, "день", "дня", "дней")} подряд
            </p>
          )}
        </div>

        {!state.sets.length && (
          <div className="mt-6 rounded-xl border border-dashed bg-card p-8 text-center">
            <p className="font-bold">Сначала добавьте материал</p>
            <Button asChild className="mt-4 rounded-md font-bold">
              <Link href="/catalog">Готовый курс немецкого</Link>
            </Button>
          </div>
        )}

        <div className="mt-8 rounded-xl border bg-card p-5">
          <p className="flex items-center gap-2 font-extrabold">
            <Sparkles className="size-4 text-primary" />
            Почему это работает
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Повторение прямо перед тем, как слово забудется, укрепляет память сильнее, чем десять подряд повторов в
            один день. 15 минут каждый день дадут больше, чем два часа раз в неделю.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Формы глаголов попадают сюда после того, как вы разберёте их в{" "}
            <Link href="/verbs" className="font-bold text-primary underline">
              тренажёре спряжения
            </Link>
            .
          </p>
        </div>
      </div>
    )
  }

  /* ---------------- session ---------------- */
  if (!current) return <Skeleton className="mx-auto mt-10 h-80 max-w-2xl rounded-xl" />

  const progressPercent = ((index + 1) / queue.length) * 100

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between text-sm font-bold">
        <span className="truncate text-muted-foreground">
          {current.kind === "card" ? current.card.set.title : "Спряжение глаголов"}
        </span>
        <span className="tabular-nums">
          {index + 1} / {queue.length}
        </span>
      </div>
      <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${progressPercent}%` }} />
      </div>

      {current.kind === "verb" ? (
        <VerbQuestion
          verb={current.slot.verb}
          tense={current.slot.tense}
          person={current.person}
          onAnswered={(result) => {
            const correct = result === "correct"
            recordVerbAnswer(current.slot.key, correct)
            score(correct)
          }}
          onNext={next}
        />
      ) : (
        <>
          <div className="rounded-xl border-2 bg-card p-6 sm:p-8">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {currentCard!.box >= 2 ? "Введите перевод" : "Выберите перевод"}
                <span className="ml-2 text-primary">уровень {currentCard!.box}/5</span>
              </p>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => speak(currentCard!.term.term, currentCard!.set.termLang)}
                aria-label="Озвучить"
              >
                <Volume2 className="size-4" />
              </Button>
            </div>
            <p className="mt-5 text-2xl font-bold leading-snug text-balance sm:text-3xl">{currentCard!.term.term}</p>
          </div>

          <div className="mt-6">
            {currentCard!.box >= 2 ? (
              <WrittenInput
                value={input}
                verdict={verdict}
                onChange={setInput}
                onSubmit={() => {
                  if (verdict !== "idle") return
                  const result = gradeAnswer(input, currentCard!.term.definition, state.settings.accentInsensitive)
                  setVerdict(result)
                  const correct = result !== "wrong"
                  recordAnswer(currentCard!.set.id, currentCard!.term.id, correct)
                  score(correct)
                }}
                onSkip={() => {
                  setVerdict("wrong")
                  recordAnswer(currentCard!.set.id, currentCard!.term.id, false)
                  score(false)
                }}
              />
            ) : (
              <ChoiceGrid
                options={options}
                answerId={currentCard!.term.id}
                selectedId={picked}
                disabled={verdict !== "idle"}
                onSelect={(id) => {
                  if (verdict !== "idle") return
                  setPicked(id)
                  const correct = id === currentCard!.term.id
                  setVerdict(correct ? "correct" : "wrong")
                  recordAnswer(currentCard!.set.id, currentCard!.term.id, correct)
                  score(correct)
                  if (correct) window.setTimeout(next, 550)
                }}
              />
            )}
            {(currentCard!.box >= 2 || verdict === "wrong") && (
              <VerdictBanner
                verdict={verdict}
                correctAnswer={currentCard!.term.definition}
                onNext={() => {
                  if (queue && index + 1 >= queue.length) completeRound(currentCard!.set.id)
                  next()
                }}
              />
            )}
          </div>
        </>
      )}

      <div className="mt-6 flex justify-center gap-6 text-sm font-bold text-muted-foreground">
        <span className="text-chart-2">Вспомнили: {stats.correct}</span>
        <span className="text-destructive">Забыли: {stats.wrong}</span>
      </div>
    </div>
  )
}
