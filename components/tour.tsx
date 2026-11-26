"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { useStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * The walk-through a first-time visitor sees: a dimmed screen with one real
 * element lit up at a time, and a card explaining it.
 *
 * Real elements rather than pictures of them, because the tab bar sits in a
 * different place on a phone and on a desktop, and a picture would go stale
 * the first time either moves. Steps whose element is not on the page — the
 * example module, before anything has been created — are stepped over.
 *
 * Nothing underneath can be clicked while it runs: the overlay swallows the
 * taps, so an explanation cannot be navigated away from by accident.
 */

type Step = {
  /** data-tour attribute of the element to light up; centred when absent. */
  anchor?: string
  title: string
  text: string
}

const STEPS: Step[] = [
  {
    title: "Пара слов, и начнём",
    text: "Покажу за полминуты, где что лежит. Если и так всё понятно — «Пропустить», больше спрашивать не буду.",
  },
  {
    anchor: "create",
    title: "Отсюда появляются модули",
    text: "Набрать список руками, вставить готовый текстом или снять доску на телефон — снимок распознаётся прямо в браузере, без отправки куда-либо.",
  },
  {
    anchor: "nav-review",
    title: "Повторение",
    text: "Карточки возвращаются по интервалам: что помните твёрдо — реже, что забывается — чаще. Цифра на вкладке говорит, сколько их ждёт сегодня.",
  },
  {
    anchor: "nav-library",
    title: "Библиотека",
    text: "Все модули и папки. Там же поиск — он ищет и по названиям, и по словам внутри модулей.",
  },
  {
    anchor: "nav-drills",
    title: "Тренировки",
    text: "Спряжение немецких глаголов, отдельно от ваших модулей: шесть времён, по лицам, с проверкой.",
  },
  {
    anchor: "set-card",
    title: "Внутри модуля — шесть режимов",
    text: "Карточки, заучивание, письмо, диктант, тест и игра «Подбор». Начните с карточек: приложение запомнит, что далось тяжело, и вернёт это в повторение.",
  },
  {
    title: "Карточки работают в обе стороны",
    text: "В модуле, под карточкой, есть кнопка со стрелками — «DE → RU». Нажмёте — станет «RU → DE»: сначала перевод, потом слово. Переключатель общий для всех режимов, каждый раз выбирать не нужно.",
  },
]

/** The visible one, when a step's element exists twice (sidebar and tab bar). */
function findAnchor(name: string) {
  if (typeof document === "undefined") return null
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`))
  return nodes.find((node) => node.getClientRects().length > 0 && node.getBoundingClientRect().width > 0) ?? null
}

function exists(step: Step) {
  return !step.anchor || Boolean(findAnchor(step.anchor))
}

const CARD_WIDTH = 340
const GAP = 14

export function Tour() {
  const { state, ready, updateSettings } = useStore()
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)
  const [index, setIndex] = React.useState(0)
  const [rect, setRect] = React.useState<DOMRect | null>(null)
  const started = React.useRef(false)

  // Asking for the tour again (from the settings) rearms it.
  React.useEffect(() => {
    if (!state.settings.tourSeen) started.current = false
  }, [state.settings.tourSeen])

  React.useEffect(() => {
    if (!ready || started.current || state.settings.tourSeen || pathname !== "/") return
    started.current = true
    setIndex(0)
    setOpen(true)
  }, [ready, state.settings.tourSeen, pathname])

  /**
   * Follows its element frame by frame while the step is on screen.
   *
   * Scroll and resize events are not enough: the page is still gliding to the
   * element when the first measurement is taken, and a card that loads an
   * image under the ring moves it again afterwards. Watching each frame costs
   * nothing for the few seconds a step lasts, and the state is only replaced
   * when the rectangle has actually moved.
   */
  React.useEffect(() => {
    if (!open) return
    const element = STEPS[index].anchor ? findAnchor(STEPS[index].anchor!) : null
    if (!element) {
      setRect(null)
      return
    }
    element.scrollIntoView({ block: "center", behavior: "smooth" })
    let frame = 0
    const follow = () => {
      const next = element.getBoundingClientRect()
      setRect((previous) =>
        previous &&
        previous.x === next.x &&
        previous.y === next.y &&
        previous.width === next.width &&
        previous.height === next.height
          ? previous
          : next,
      )
      frame = window.requestAnimationFrame(follow)
    }
    follow()
    return () => window.cancelAnimationFrame(frame)
  }, [open, index])

  const finish = React.useCallback(() => {
    setOpen(false)
    updateSettings({ tourSeen: true })
  }, [updateSettings])

  const step = (direction: 1 | -1) => {
    let next = index + direction
    while (next > 0 && next < STEPS.length && !exists(STEPS[next])) next += direction
    if (next >= STEPS.length) return finish()
    setIndex(Math.max(0, next))
  }

  React.useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, finish])

  if (!open) return null

  const current = STEPS[index]
  const shown = STEPS.filter(exists)
  const position = shown.indexOf(current) + 1
  const last = position >= shown.length

  const width = Math.min(CARD_WIDTH, (typeof window === "undefined" ? CARD_WIDTH : window.innerWidth) - 32)
  const card: React.CSSProperties = rect
    ? {
        width,
        left: Math.min(
          Math.max(16, rect.left + rect.width / 2 - width / 2),
          Math.max(16, window.innerWidth - width - 16),
        ),
        // Above the element when it sits in the lower half of the screen.
        ...(rect.top > window.innerHeight / 2
          ? { bottom: window.innerHeight - rect.top + GAP }
          : { top: rect.bottom + GAP }),
      }
    : { width, left: "50%", top: "50%", transform: "translate(-50%, -50%)" }

  return (
    <div
      className="fixed inset-0 z-[60]"
      style={{ background: rect ? "transparent" : "rgba(0,0,0,0.6)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Знакомство с приложением"
    >
      {rect && (
        <div
          aria-hidden
          data-tour-spotlight={STEPS[index].anchor}
          // No CSS transition: the ring is already moved frame by frame, and a
          // transition on top of that would trail behind the scrolling page.
          className="pointer-events-none fixed rounded-lg outline outline-2 outline-primary"
          style={{
            left: rect.left - 6,
            top: rect.top - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
          }}
        />
      )}

      <div className="fixed rounded-xl border bg-card p-5 shadow-lg" style={card}>
        <p className="display-type text-base font-extrabold">{current.title}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{current.text}</p>

        <div className="mt-4 flex items-center gap-1.5">
          {shown.map((item, dot) => (
            <span
              key={item.title}
              className={cn("h-1.5 rounded-full transition-all", dot === position - 1 ? "w-5 bg-primary" : "w-1.5 bg-muted")}
            />
          ))}
          <span className="ml-auto text-xs font-bold tabular-nums text-muted-foreground">
            {position} / {shown.length}
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" className="font-bold text-muted-foreground" onClick={finish}>
            Пропустить
          </Button>
          <div className="flex items-center gap-2">
            {position > 1 && (
              <Button variant="outline" size="sm" className="font-bold" onClick={() => step(-1)}>
                Назад
              </Button>
            )}
            <Button size="sm" className="font-bold" onClick={() => (last ? finish() : step(1))}>
              {last ? "Понятно" : "Далее"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
