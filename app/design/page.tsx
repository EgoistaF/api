"use client"

import * as React from "react"
import {
  ArrowRight,
  BookOpen,
  Check,
  Flame,
  Gamepad2,
  GraduationCap,
  Keyboard,
  Layers,
  Star,
  Timer,
  Trophy,
  Volume2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import "./palettes.css"
import "./lora.css"

/**
 * The serif used by the "warm paper" palette, served from this repository
 * rather than fetched by next/font at build time: Google has started handing
 * out font URLs that carry a query string, which the bundler's font loader
 * cannot resolve, and a build that reaches for a font over the network is one
 * more thing that can stop a deploy. See lora.css.
 */
const DISPLAY_FONT = "font-lora"

type PaletteId = "graphite" | "paper" | "berlin"

const PALETTES: { id: PaletteId; name: string; note: string; swatches: string[] }[] = [
  {
    id: "graphite",
    name: "Графит и мята",
    note: "Спокойный зелёно-бирюзовый, янтарь для важного. Мягкие скругления, шрифт как сейчас.",
    swatches: ["#0f9d76", "#f5a524", "#0e1c18", "#f3f6f5"],
  },
  {
    id: "paper",
    name: "Тёплая бумага",
    note: "Кремовый фон, чернильный текст, терракота и глубокая зелень. Заголовки с засечками.",
    swatches: ["#bd4524", "#2f7d6b", "#241a12", "#faf5ee"],
  },
  {
    id: "berlin",
    name: "Берлин",
    note: "Почти монохром: чёрные кнопки, сигнальный жёлтый. Острые углы, плотные прописные заголовки.",
    swatches: ["#18181b", "#ffd400", "#0d0d0d", "#f1f1ee"],
  },
]

const MODES = [
  { icon: Layers, label: "Карточки" },
  { icon: GraduationCap, label: "Заучивание" },
  { icon: Keyboard, label: "Письмо" },
  { icon: Volume2, label: "Диктант" },
  { icon: BookOpen, label: "Тест" },
  { icon: Gamepad2, label: "Подбор" },
]

export default function DesignPage() {
  const [palette, setPalette] = React.useState<PaletteId>("graphite")
  const [dark, setDark] = React.useState(false)

  // The palette is applied the same way it will be applied for real: one
  // attribute on <html>. Removed again when leaving the page.
  React.useEffect(() => {
    const root = document.documentElement
    const hadDark = root.classList.contains("dark")
    root.dataset.palette = palette
    root.classList.toggle("dark", dark)
    // --display-family resolves against :root, so the font variable has to
    // be defined there too, not on an inner wrapper.
    root.classList.add(DISPLAY_FONT)
    return () => {
      delete root.dataset.palette
      root.classList.toggle("dark", hadDark)
      root.classList.remove(DISPLAY_FONT)
    }
  }, [palette, dark])

  const active = PALETTES.find((item) => item.id === palette)!

  return (
    <div className="min-h-dvh bg-background pb-20 text-foreground">
      {/* controls */}
      <div className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {PALETTES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPalette(item.id)}
                className={cn(
                  "flex items-center gap-2 rounded-full border-2 px-3 py-1.5 text-sm font-bold transition-colors",
                  palette === item.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary",
                )}
              >
                <span className="flex -space-x-1">
                  {item.swatches.slice(0, 3).map((color) => (
                    <span key={color} className="size-3.5 rounded-full border border-card" style={{ background: color }} />
                  ))}
                </span>
                {item.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setDark((value) => !value)}
              className="ml-auto rounded-full border-2 border-border px-3 py-1.5 text-sm font-bold hover:bg-secondary"
            >
              {dark ? "Тёмная" : "Светлая"}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{active.note}</p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-10 px-4 py-8">
        <Section title="Заголовки и текст">
          <h1 className="display-type text-3xl font-extrabold leading-tight sm:text-4xl">Продолжите с того места, где остановились</h1>
          <h2 className="display-type mt-4 text-xl font-extrabold">Недавние модули</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Обычный текст абзаца: так будут выглядеть описания модулей, подсказки под полями ввода и пояснения в
            настройках.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button className="rounded-full font-bold">Основная кнопка</Button>
            <Button variant="outline" className="rounded-full font-bold">
              Вторичная
            </Button>
            <Button variant="ghost" className="rounded-full font-bold">
              Третичная
            </Button>
            <Button variant="destructive" className="rounded-full font-bold">
              Удалить
            </Button>
          </div>
        </Section>

        <Section title="Главная: продолжить и режимы">
          <div className="overflow-hidden rounded-xl border bg-gradient-to-br from-primary/10 via-card to-accent/10 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">Все режимы открыты</span>
              <span className="rounded-full bg-accent/25 px-3 py-1 text-xs font-bold text-accent-foreground dark:text-accent">Без лимитов</span>
              <span className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs font-bold">
                <Flame className="size-3.5 text-accent" />
                Серия: 6 дней
              </span>
            </div>
            <h3 className="display-type mt-4 text-2xl font-extrabold leading-tight">Deutsch A1 — der, die, das</h3>
            <p className="mt-1 text-sm text-muted-foreground">12 терминов · освоено 40%</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button className="h-11 rounded-full px-5 font-bold">
                Учить дальше
                <ArrowRight className="size-4" />
              </Button>
              <Button variant="outline" className="h-11 rounded-full px-5 font-bold">
                Карточки
              </Button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
            {MODES.map((mode) => (
              <div
                key={mode.label}
                className="flex flex-col items-center gap-2 rounded-xl border bg-card px-2 py-4 text-center font-bold"
              >
                <mode.icon className="size-5" />
                <span className="text-xs">{mode.label}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Карточки модулей">
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { title: "A1 · Еда и напитки", count: 61, percent: 72 },
              { title: "B1 · Глаголы с предлогами", count: 55, percent: 18 },
            ].map((set) => (
              <div key={set.title} className="rounded-xl border bg-card p-4">
                <p className="font-bold leading-snug">{set.title}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground">{set.count} терминов</span>
                  <span className="flex items-center gap-1 rounded-full bg-accent/20 px-2.5 py-1 text-accent-foreground dark:text-accent">
                    <Star className="size-3 fill-current" />4
                  </span>
                </div>
                <div className="mt-4 mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Учили 2 часа назад</span>
                  <span className="font-bold text-foreground">{set.percent}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${set.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Экран тренировки">
          <div className="rounded-2xl border-2 bg-card p-6">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Выберите верный ответ <span className="ml-2 text-primary">уровень 2/5</span>
            </p>
            <p className="mt-4 text-2xl font-bold leading-snug">die Erfahrung</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Учебный текст намеренно без стилизации заголовков: прописные буквы исказили бы немецкое слово.
            </p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Choice label="опыт" state="correct" />
            <Choice label="ожидание" state="wrong" />
            <Choice label="развитие" state="idle" />
            <Choice label="требование" state="idle" />
          </div>
        </Section>

        <Section title="Ввод ответа">
          <div className="space-y-3">
            <Input placeholder="Введите ответ" className="h-14 rounded-xl border-2 text-base font-semibold" />
            <Input
              defaultValue="разведён / разведена"
              readOnly
              className="h-14 rounded-xl border-2 border-chart-2 bg-chart-2/10 text-base font-semibold"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-destructive bg-destructive/10 p-4">
              <div>
                <p className="font-extrabold">Правильный ответ:</p>
                <p className="mt-0.5 font-semibold">die Erfahrung</p>
              </div>
              <Button className="rounded-full font-bold">Дальше</Button>
            </div>
          </div>
        </Section>

        <Section title="Артикли и прогресс">
          <div className="grid grid-cols-3 gap-3">
            {[
              { word: "der", color: "var(--chart-4)" },
              { word: "die", color: "var(--destructive)" },
              { word: "das", color: "var(--chart-2)" },
            ].map((item, index) => (
              <button
                key={item.word}
                type="button"
                className="flex h-24 flex-col items-center justify-center gap-1 rounded-2xl border-2 bg-card text-2xl font-extrabold"
                style={{ color: item.color }}
              >
                {item.word}
                <span className="text-xs font-bold text-muted-foreground">{index + 1}</span>
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-xl border bg-card p-5">
            <p className="text-sm font-bold text-muted-foreground">Освоено материала</p>
            <p className="display-type text-3xl font-extrabold">64%</p>
            <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-muted">
              <div className="bg-chart-2" style={{ width: "40%" }} />
              <div className="bg-primary" style={{ width: "24%" }} />
              <div className="bg-accent" style={{ width: "16%" }} />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: Flame, value: "6", label: "Серия дней" },
              { icon: Timer, value: "18,4 с", label: "Рекорд «Подбор»" },
              { icon: Layers, value: "43", label: "Модулей" },
              { icon: GraduationCap, value: "1786", label: "Карточек" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border bg-card p-4">
                <stat.icon className="size-5 text-primary" />
                <p className="mt-2 text-2xl font-extrabold tabular-nums">{stat.value}</p>
                <p className="text-xs font-bold text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Экран итогов">
          <div className="rounded-2xl border-2 bg-card p-6 text-center">
            <Trophy className="mx-auto size-10 text-accent" />
            <p className="display-type mt-3 text-4xl font-extrabold">92%</p>
            <p className="mt-1 text-sm font-bold text-muted-foreground">Верно 23 из 25</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button className="rounded-full font-bold">Новый тест</Button>
              <Button variant="outline" className="rounded-full font-bold">
                Повторить ошибки
              </Button>
            </div>
          </div>
        </Section>

        <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
          Служебная страница для выбора оформления. На неё нет ссылок из приложения, и выбранная палитра
          применяется только пока она открыта.
        </p>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</h2>
      {children}
    </section>
  )
}

function Choice({ label, state }: { label: string; state: "idle" | "correct" | "wrong" }) {
  return (
    <div
      className={cn(
        "flex min-h-[4.5rem] items-center gap-3 rounded-xl border-2 bg-card p-4 font-semibold",
        state === "correct" && "border-chart-2 bg-chart-2/10",
        state === "wrong" && "border-destructive bg-destructive/10",
      )}
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-secondary text-xs font-bold text-secondary-foreground">
        1
      </span>
      <span className="flex-1">{label}</span>
      {state === "correct" && <Check className="size-5 text-chart-2" />}
      {state === "wrong" && <X className="size-5 text-destructive" />}
    </div>
  )
}
