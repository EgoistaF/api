"use client"

import * as React from "react"
import { Check, Volume2, X } from "lucide-react"
import { speak } from "@/lib/speech"
import { conjugate, conjugateOne, personsFor } from "@/lib/verbs/conjugate"
import { gradeVerbAnswer, type VerbVerdict } from "@/lib/verbs/grade"
import { PERSON_LABELS, TENSE_HINTS, TENSE_LABELS, type Person, type Tense, type VerbEntry } from "@/lib/verbs/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/**
 * One conjugation question. Shared by the trainer and the daily review so the
 * two cannot drift apart: same prompt, same strict grading, same explanation.
 */
export function VerbQuestion({
  verb,
  tense,
  person,
  onAnswered,
  onNext,
}: {
  verb: VerbEntry
  tense: Tense
  person: Person
  onAnswered: (verdict: VerbVerdict, given: string) => void
  onNext: () => void
}) {
  const [input, setInput] = React.useState("")
  const [verdict, setVerdict] = React.useState<VerbVerdict | "idle">("idle")
  const inputRef = React.useRef<HTMLInputElement>(null)

  const slot = `${verb.infinitive}|${tense}|${person}`
  React.useEffect(() => {
    setInput("")
    setVerdict("idle")
  }, [slot])

  React.useEffect(() => {
    if (verdict === "idle") inputRef.current?.focus()
  }, [verdict, slot])

  const answer = conjugateOne(verb, tense, person) ?? ""
  const row = conjugate(verb, tense)
  const revealed = verdict === "wrong" || verdict === "umlaut"

  function submit() {
    if (verdict !== "idle") return
    const result = gradeVerbAnswer(verb, tense, person, input)
    setVerdict(result)
    onAnswered(result, input.trim())
    if (result === "correct") window.setTimeout(onNext, 550)
  }

  return (
    <div>
      <div className="rounded-xl border-2 bg-card p-6">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {TENSE_LABELS[tense]} · {TENSE_HINTS[tense]}
          </p>
          <Button variant="ghost" size="icon" className="size-8" aria-label="Озвучить" onClick={() => speak(verb.infinitive, "de-DE")}>
            <Volume2 className="size-4" />
          </Button>
        </div>
        <p className="mt-4 text-2xl font-bold sm:text-3xl">{verb.infinitive}</p>
        <p className="mt-1 text-sm text-muted-foreground">{verb.translation}</p>
        <p className="mt-5 flex items-baseline gap-3 text-xl font-bold">
          <span className="text-primary">{PERSON_LABELS[person]}</span>
          <span className="min-w-[8rem] border-b-2 border-dashed border-input pb-1 text-muted-foreground">
            {verdict === "idle" ? "…" : answer}
          </span>
        </p>
      </div>

      <form
        className="mt-5"
        onSubmit={(event) => {
          event.preventDefault()
          if (verdict === "idle") submit()
          else onNext()
        }}
      >
        <Input
          ref={inputRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={verdict !== "idle"}
          placeholder="Напишите форму"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className={cn(
            "h-14 rounded-md border-2 text-base font-semibold",
            verdict === "correct" && "border-chart-2 bg-chart-2/10",
            verdict === "umlaut" && "border-accent bg-accent/10",
            verdict === "wrong" && "animate-shake border-destructive bg-destructive/10",
          )}
        />
        {verdict === "idle" && (
          <div className="mt-3 flex gap-2">
            <Button type="submit" className="h-11 flex-1 rounded-md font-bold">
              Проверить
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-md font-bold"
              onClick={() => {
                setVerdict("wrong")
                onAnswered("wrong", "")
              }}
            >
              Не знаю
            </Button>
          </div>
        )}
      </form>

      {verdict !== "idle" && (
        <div className="animate-pop-in mt-4">
          <div
            className={cn(
              "flex flex-wrap items-center justify-between gap-3 rounded-md border-2 p-4",
              verdict === "correct" && "border-chart-2 bg-chart-2/10",
              verdict === "umlaut" && "border-accent bg-accent/10",
              verdict === "wrong" && "border-destructive bg-destructive/10",
            )}
          >
            <div className="flex min-w-0 items-start gap-2">
              {verdict === "correct" ? (
                <Check className="mt-0.5 size-5 shrink-0 text-chart-2" />
              ) : (
                <X className="mt-0.5 size-5 shrink-0 text-destructive" />
              )}
              <div className="min-w-0">
                <p className="font-extrabold">
                  {verdict === "correct"
                    ? "Верно!"
                    : verdict === "umlaut"
                      ? "Не хватает умляута — в спряжении это ошибка"
                      : "Правильная форма:"}
                </p>
                {verdict !== "correct" && <p className="mt-0.5 break-words font-bold">{answer}</p>}
              </div>
            </div>
            <Button onClick={onNext} className="rounded-md font-bold">
              Дальше
            </Button>
          </div>

          {revealed && (
            <div className="mt-3 rounded-md border bg-card p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {verb.infinitive} · {TENSE_LABELS[tense]}
              </p>
              <div className="grid gap-1 sm:grid-cols-2">
                {personsFor(tense).map((item) => (
                  <div
                    key={item}
                    className={cn("flex items-baseline gap-2 rounded px-2 py-1 text-sm", item === person && "bg-accent/25 font-bold")}
                  >
                    <span className="w-20 shrink-0 text-muted-foreground">{PERSON_LABELS[item]}</span>
                    <span>{row[item]}</span>
                  </div>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 font-bold"
                onClick={() => speak(`${PERSON_LABELS[person].split("/")[0]} ${answer}`, "de-DE")}
              >
                <Volume2 className="size-4" />
                Послушать
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
