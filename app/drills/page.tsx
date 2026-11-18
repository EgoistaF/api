"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight, BookOpen, CalendarCheck, Dumbbell, Gamepad2, GraduationCap, Keyboard, Languages, Layers, Volume2, Zap } from "lucide-react"
import { useStore } from "@/lib/store"
import { collectArticleCards, collectDue, formatDueIn, nextDueAt } from "@/lib/review"
import { plural } from "@/lib/text"
import { SetCard } from "@/components/set-card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

const SET_MODES = [
  { slug: "flashcards", label: "Карточки", icon: Layers },
  { slug: "learn", label: "Заучивание", icon: GraduationCap },
  { slug: "write", label: "Письмо", icon: Keyboard },
  { slug: "spell", label: "Диктант", icon: Volume2 },
  { slug: "test", label: "Тест", icon: BookOpen },
  { slug: "match", label: "Подбор", icon: Gamepad2 },
]

export default function DrillsPage() {
  const { state, ready } = useStore()

  const due = React.useMemo(() => (ready ? collectDue(state) : []), [state, ready])
  const upcoming = React.useMemo(() => (ready ? nextDueAt(state) : null), [state, ready])
  const nouns = React.useMemo(() => (ready ? collectArticleCards(state) : []), [state, ready])

  const recent = React.useMemo(() => {
    const byId = new Map(state.sets.map((set) => [set.id, set]))
    const fromRecent = state.recent.map((id) => byId.get(id)).filter(Boolean)
    const rest = state.sets.filter((set) => !state.recent.includes(set.id)).sort((a, b) => b.updatedAt - a.updatedAt)
    return [...fromRecent, ...rest].slice(0, 6) as typeof state.sets
  }, [state.sets, state.recent])

  if (!ready) return <Skeleton className="mx-auto mt-10 h-96 max-w-4xl rounded-xl" />

  const focus = recent[0]

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
          <Dumbbell className="size-6" />
        </span>
        <div>
          <h1 className="display-type text-2xl font-extrabold tracking-tight">Тренировки</h1>
          <p className="mt-1 text-sm text-muted-foreground">Всё, чем можно заняться прямо сейчас.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link
          href="/review"
          className="flex flex-col justify-between rounded-xl border bg-card p-5 transition-colors hover:border-primary"
        >
          <div>
            <CalendarCheck className="size-6 text-primary" />
            <p className="display-type mt-3 font-extrabold">Повторение по расписанию</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {due.length
                ? `${due.length} ${plural(due.length, "карточка", "карточки", "карточек")} ждёт повторения`
                : upcoming
                  ? `Всё повторено. Следующее через ${formatDueIn(upcoming)}`
                  : "Интервалы 1 → 2 → 4 → 8 → 21 день"}
            </p>
          </div>
          <span className="mt-4 flex items-center gap-1.5 text-sm font-bold text-primary">
            {due.length ? "Повторить" : "Открыть"}
            <ArrowRight className="size-4" />
          </span>
        </Link>

        <Link
          href="/articles"
          className="flex flex-col justify-between rounded-xl border bg-card p-5 transition-colors hover:border-primary"
        >
          <div>
            <Zap className="size-6 text-accent-foreground dark:text-accent" />
            <p className="display-type mt-3 font-extrabold">Тренажёр артиклей</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {nouns.length
                ? `der / die / das по ${nouns.length} ${plural(nouns.length, "существительному", "существительным", "существительным")}`
                : "Добавьте немецкие модули — слова возьмутся оттуда"}
            </p>
          </div>
          <span className="mt-4 flex items-center gap-1.5 text-sm font-bold text-primary">
            Начать
            <ArrowRight className="size-4" />
          </span>
        </Link>
      </div>

      {focus ? (
        <>
          <section className="mt-10">
            <h2 className="display-type mb-1 text-lg font-extrabold">Режимы для модуля</h2>
            <p className="mb-3 truncate text-sm text-muted-foreground">{focus.title}</p>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {SET_MODES.map((mode) => (
                <Link
                  key={mode.slug}
                  href={`/set/${focus.id}/${mode.slug}`}
                  className="flex flex-col items-center gap-2 rounded-xl border bg-card px-2 py-4 text-center font-bold transition-colors hover:border-primary hover:text-primary"
                >
                  <mode.icon className="size-5" />
                  <span className="text-xs">{mode.label}</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="mt-10">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="display-type text-lg font-extrabold">Другой модуль</h2>
              <Button asChild variant="ghost" className="font-bold">
                <Link href="/library">
                  Вся библиотека
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recent.map((set) => (
                <SetCard key={set.id} set={set} compact />
              ))}
            </div>
          </section>
        </>
      ) : (
        <div className="mt-8 rounded-xl border border-dashed bg-card p-10 text-center">
          <Languages className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-bold">Пока нечего тренировать</p>
          <p className="mt-1 text-sm text-muted-foreground">Добавьте готовый курс или создайте свой модуль.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button asChild className="rounded-md font-bold">
              <Link href="/catalog">Готовый курс немецкого</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-md font-bold">
              <Link href="/create">Создать модуль</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
